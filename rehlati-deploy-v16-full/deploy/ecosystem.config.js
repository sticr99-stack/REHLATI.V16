// رحلتي — تشغيل بـ PM2 على VPS بدون Docker
// الاستخدام: pm2 start deploy/ecosystem.config.js && pm2 save
module.exports = {
  apps: [{
    name: 'rehlati',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: '/var/www/rehlati', // عدّل لمجلد مشروعك
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
