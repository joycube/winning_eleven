// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// 🚨 대표님의 실제 Firebase 설정값으로 변경해주세요!
const firebaseConfig = {
  apiKey: "AIzaSyAWo7owWvLFLcj1i9LGatdZkFgdrdvvS1k",
  authDomain: "efootball-29514.firebaseapp.com",
  projectId: "efootball-29514",
  storageBucket: "efootball-29514.firebasestorage.app",
  messagingSenderId: "692761560044",
  appId: "1:692761560044:web:3a8b22fa7801bf49ca36c9"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.webp' // public 폴더에 있는 파비콘이나 로고 이미지 이름
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});