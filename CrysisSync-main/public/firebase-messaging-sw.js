importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDbAQSaJ4QmxShVMXF-6dYt83cG7T-W2XM",
  authDomain: "gen-lang-client-0023623173.firebaseapp.com",
  projectId: "gen-lang-client-0023623173",
  storageBucket: "gen-lang-client-0023623173.firebasestorage.app",
  messagingSenderId: "949286803708",
  appId: "1:949286803708:web:4299e7c57bdbb5d15f5f79"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
