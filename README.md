# Online Chat Platform

## **Overview**

This project is a full-stack real-time messaging application inspired by **WhatsApp**. It enables authenticated users to create accounts, find other users, and communicate through text messages, images, and live audio/video calls.

The application is deployed and accessible online — frontend hosted on **Vercel**, backend on **Render**.

🔗 **Live demo:** [aplicatiechat.vercel.app](https://aplicatiechat.vercel.app/)

---

## **Features**

- User registration and authentication
- Real-time text messaging between users
- Image sharing within conversations
- Audio and video calls
- Conversation management and history
- Responsive UI inspired by modern chat applications

---

## **Architecture**

### **Frontend**
- Built with **React** and **JavaScript**
- Communicates with the backend via **REST APIs** and **WebSockets**
- Deployed on **Vercel**

### **Backend**
- Built with **Node.js** and **Express**
- Handles authentication, conversation management, and message storage via **REST APIs**
- Real-time communication implemented using **WebSockets / Socket.IO**
- Deployed on **Render**

### **Real-Time Communication Flow**
```
Client (React) ←→ Socket.IO ←→ Server (Node.js/Express) ←→ Other Client
```

### **Authentication Flow**
```
User Register/Login → REST API → JWT Token → Authenticated Session
```

---

## **Technologies Used**

- **React** — frontend UI framework
- **JavaScript** — primary language (88.4%)
- **CSS** — styling (11.0%)
- **Node.js** — backend runtime
- **Express** — REST API framework
- **Socket.IO / WebSockets** — real-time bidirectional communication
- **Vercel** — frontend cloud hosting
- **Render** — backend cloud hosting

---

## **Getting Started**

### **Prerequisites**
- Node.js installed
- npm or yarn

### **Run locally**

**Backend:**
```bash
cd backend
npm install
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## **Learning Objectives**

This project was created to deepen understanding of:

- Full-stack web application architecture
- Real-time communication with WebSockets and Socket.IO
- REST API design for authentication and data management
- Frontend-backend integration with React and Node.js
- Cloud deployment with Vercel and Render
