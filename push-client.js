const publicVapidKey = 'BNwGaSbwVrshdsL2H8pFbyeg5UCgJdQKSeGLCiPjoDB-3LyKaBZVjlG8ASOuqUfb7btmdh0NS1CKG6lV2mrnGKY'; // Replace this with your actual public VAPID key

if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', registration);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      // Send subscription to server
      await fetch('/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📩 Push subscription sent to server');
    } catch (error) {
      console.error('❌ Push subscription error:', error);
    }
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map((char) => char.charCodeAt(0)));
}
