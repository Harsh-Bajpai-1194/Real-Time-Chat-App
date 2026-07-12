# Real-Time Chat App v1.2.10

A real-time chat application built with the **MERN** stack (**MongoDB**, **Express**, **React**, **Node.js**) and **Socket.IO**.

---

## 🚀 Core Features
- Real-time communication using WebSockets (Socket.IO)
- Frontend built with **React**
- Backend powered by Node.js and Express
- Can be accessed globally using **ngrok**

---

## 📂 Project Structure

```yaml
📦Real-Time-Chat-App/
┣ 📂client/              # React frontend application
┃ ┣ 📂public/            # Public assets (icons, index.html)
┃ ┣ 📂src/               # React source code
┃ ┣ 📜package.json       # Frontend dependencies
┃ ┗ ...
┣ 📂server/              # Node.js backend application
┃ ┣ 📂models/            # Mongoose schemas (Message.js, Room.js)
┃ ┣ 📜index.js           # Main server file (Express, Socket.IO)
┃ ┣ 📜package.json       # Backend dependencies
┃ ┗ ...
┣ 📜.env                 # Environment variables (MONGO_URI, etc.)
┣ 📜.gitignore           # Git ignore rules
┣ 📜package.json         # Root package with dev scripts
┣ 📜pnpm-lock.yaml       # PNPM lock file
┗ 📜README.md            # This file
```
---

## 🖥️ Run Locally
1. **Clone & Install**
   Clone the repo and install all dependencies from the root directory:
   ```bash
   git clone https://github.com/Harsh-Bajpai-1194/Real-Time-Chat-App.git
   cd Real-Time-Chat-App
   pnpm install
   ```

2. **Set Up Environment**
   Create a `.env` file in the root directory and add your variables. This file is used by the server.
   ```
   # For the React frontend (must start with REACT_APP_)
   REACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com
   # For the Node.js backend (used for token verification)
   GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com
   MONGO_URI=your_mongodb_connection_string
   ADMIN_EMAIL=your_admin_email@gmail.com
   PORT=7777
   ```

3. **Run the App**
   Start both the client and server concurrently from the root directory:
   ```bash
   pnpm run dev
   ```

4. **Access the App**
   - The React frontend will be available at `http://localhost:3000`.
   - The Express backend will be running on `http://localhost:7777`.

---

## ⚡ Tech Stack
- **Frontend**: React
- **Backend**: Node.js, Express
- **Database**: MongoDB (with Mongoose)
- **Real-Time**: Socket.IO

---

## 📌 Notes
- GitHub Pages can only host static frontend files.  
- The backend (`server/index.js`) must be running locally or on a hosting service (ngrok, Render, Railway, etc.).  
- For a permanent public app, consider deploying the backend on **Render**, **Heroku**, or **Railway**.
