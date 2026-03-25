/**
 * Swagger UI - Auto Authorization
 * Tự động authorize sau khi login/register thành công
 */
(function () {
  'use strict';

  // Đợi Swagger UI load xong
  window.addEventListener('load', function () {
    console.log('[Swagger Auto-Auth] Script loaded');

    // Intercept fetch để bắt response của login/register
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      // Clone response để đọc body (vì body chỉ đọc được 1 lần)
      const clonedResponse = response.clone();

      try {
        const url = args[0];

        // Kiểm tra nếu là endpoint login hoặc register
        if (
          typeof url === 'string' &&
          (url.includes('/api/auth/login') || url.includes('/api/auth/register'))
        ) {
          // Đợi response body
          const data = await clonedResponse.json();

          // Kiểm tra có accessToken không
          if (data?.data?.accessToken) {
            const token = data.data.accessToken;
            console.log('[Swagger Auto-Auth] Token detected, auto-authorizing...');

            // Đợi Swagger UI object sẵn sàng
            setTimeout(() => {
              const ui = window.ui;
              if (ui && ui.authActions) {
                // Authorize với Bearer token
                ui.authActions.authorize({
                  JWT: {
                    name: 'JWT',
                    schema: {
                      type: 'http',
                      scheme: 'bearer',
                      bearerFormat: 'JWT',
                    },
                    value: token,
                  },
                });

                console.log('[Swagger Auto-Auth] ✅ Auto-authorized successfully!');

                // Hiển thị notification (optional)
                showNotification('✅ Đã tự động authorize! Bạn có thể test các protected endpoints.');
              }
            }, 500);
          }
        }
      } catch (error) {
        // Không làm gì nếu parse lỗi (không phải JSON response)
      }

      return response;
    };
  });

  // Helper: Hiển thị notification
  function showNotification(message) {
    // Tạo notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #49cc90;
      color: white;
      padding: 15px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 9999;
      font-family: sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;

    // Thêm animation CSS
    if (!document.getElementById('swagger-notification-style')) {
      const style = document.createElement('style');
      style.id = 'swagger-notification-style';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto remove sau 5 giây
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  console.log('[Swagger Auto-Auth] ✨ Auto-authorization enabled');
})();
