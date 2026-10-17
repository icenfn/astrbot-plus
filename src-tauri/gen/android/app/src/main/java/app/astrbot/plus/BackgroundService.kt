package app.astrbot.plus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * BackgroundService — a minimal Android foreground service.
 *
 * Why it exists: a WebView-hosted Socket.io connection is a plain page process. Once
 * the activity is backgrounded the OS may freeze or reclaim it within seconds, which
 * silently kills the socket and stops message notifications. Running a foreground
 * service with a persistent notification pins the process at normal priority, so the
 * connection and its auto-reconnect loop keep working while the app is away.
 *
 * It deliberately does NOT own any networking logic — the WebView keeps managing the
 * socket. The service only exists to hold the process priority and to give the user a
 * visible, dismissible-by-stop indicator that background run is active.
 */
class BackgroundService : Service() {

    companion object {
        /** Must match `MainActivity.CHANNEL_ID` / the JS-side expectation. */
        const val CHANNEL_ID = "astrbot_plus_background"
        const val NOTIFICATION_ID = 4101

        const val ACTION_START = "app.astrbot.plus.action.START_BACKGROUND"
        const val ACTION_STOP = "app.astrbot.plus.action.STOP_BACKGROUND"

        fun start(context: Context) {
            val intent = Intent(context, BackgroundService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BackgroundService::class.java))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForegroundCompat()
            stopSelf()
            return START_NOT_STICKY
        }

        ensureChannel()
        val notification = buildNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Android 14+ requires an explicit foreground service type.
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (t: Throwable) {
            // Missing POST_NOTIFICATIONS / type permission — degrade quietly instead
            // of crashing the whole app on launch.
            stopSelf()
            return START_NOT_STICKY
        }

        // START_STICKY: if the OS reclaims us under memory pressure, it restarts the
        // service so background delivery resumes without a user action.
        return START_STICKY
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "后台运行",
            // LOW: the persistent service notice must not buzz on every start.
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "保持与 AstrBot 的连接以接收消息"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val contentIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            this,
            0,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("AstrBot+ 正在后台运行")
            .setContentText("保持连接以接收消息")
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentIntent(pending)
            .setOngoing(true)
            .build()
    }
}
