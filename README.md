# Real-Time Chat App

A simple real-time chat application with **Node.js**, **Express**, and **Socket.IO**.

---

## 🚀 Features
- Real-time communication using WebSockets (Socket.IO)
- Frontend served with HTML, CSS, and JavaScript
- Backend powered by Node.js and Express
- Can be accessed globally using **ngrok**

---

## 📂 Project Structure

```yaml
📦Real-Time Chat App/
 ┣ 📂 ngork             # Extension File
 ┣ 📂 static
 ┃ ┣ 📜server.js        # Node.js backend
 ┣ 📂 templates 
 ┃ ┣ 📜index.html       # Frontend (to host on GitHub Pages)
 ┃ ┣ 📜style.css
 ┃ ┣ 📜client.js
 ┣ 📜package.json
 ┣ 📜README.md

```
---

## 🖥️ Run Locally
1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/Harsh-Bajpai-1194/Real-Time-Chat-App.git
   cd "Real-Time Chat App"
   npm install
   ```

2. Start the server:
   ```bash
   node server.js
   ```

3. The app will run on:
   ```
   http://localhost:7777
   ```

---

## 🌍 Make it Public with ngrok
1. In another terminal, run:
   ```bash
   ./ngrok/ngrok.exe http 7777
   ```
2. Copy the HTTPS forwarding URL ngrok gives you, e.g.:
   ```
   https://abcd-1234.ngrok-free.app
   ```

3. Update your **frontend JS (client.js)**:
   ```js
   const socket = io("https://abcd-1234.ngrok-free.app");
   ```

---

## 🌐 Host Frontend on GitHub Pages
1. Push only the **`public/` folder** to GitHub.  
2. Go to **Repo → Settings → Pages → Deploy from Branch → main / root**.  
3. GitHub Pages will give you a link:
   ```
   https://your-username.github.io/your-repo/
   ```

4. Your frontend is always online 🎉.  
   Start your backend with `node server.js` + `ngrok` whenever you want it live.

---

## ⚡ Tech Stack
- **Node.js**
- **Express**
- **Socket.IO**
- **ngrok**
- **GitHub Pages** (frontend hosting)

---

## 📌 Notes
- GitHub Pages can only host static frontend files.  
- The backend (`server.js`) must be running locally or on a hosting service (ngrok, Render, Railway, etc.).  
- For a permanent public app, consider deploying the backend on **Render**, **Heroku**, or **Railway**.