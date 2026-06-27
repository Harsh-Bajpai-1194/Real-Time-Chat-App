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
┣ 📂.github/              # GitHub configurations
┃ ┣ 📂workflows/        # CI/CD pipelines
┃ ┃ ┣ 📜assign-claim.yml # Issue assignment
┃ ┃ ┣ 📜unassign-stale.yml # Stale issue cleanup
┃ ┣ 📜dependabot.yml      # Dependency updates
┣ 📂client/             # Frontend application
┃ ┣ 📂public/           # Static assets
┃ ┃ ┣ 📂Backgrounds/    # UI theme assets
┃ ┃ ┃ ┣ 📜aqua.png
┃ ┃ ┃ ┣ 📜brown.png
┃ ┃ ┃ ┣ 📜green.png
┃ ┃ ┃ ┣ 📜navy-blue.png
┃ ┃ ┃ ┣ 📜orange.png
┃ ┃ ┃ ┣ 📜pink.png
┃ ┃ ┃ ┣ 📜red.png
┃ ┃ ┃ ┣ 📜sky-blue.png
┃ ┃ ┃ ┣ 📜violet.png
┃ ┃ ┃ ┣ 📜yellow.png
┃ ┃ ┣ 📜favicon.ico      # Tab icon
┃ ┃ ┣ 📜index.html       # HTML entry point
┃ ┃ ┣ 📜logo192.png      # App icon
┃ ┃ ┣ 📜logo512.png      # App icon
┃ ┃ ┣ 📜manifest.json    # PWA configuration
┃ ┃ ┣ 📜robots.txt       # Crawler rules
┃ ┣ 📂src/              # React source code
┃ ┃ ┣ 📂sounds/         # Audio notification files
┃ ┃ ┃ ┣ 📜Imagine Dragons - Belie...
┃ ┃ ┃ ┣ 📜John-Cena-The-Time-is-...
┃ ┃ ┣ 📜App.css         # Main component styles
┃ ┃ ┣ 📜App.js          # Main React component
┃ ┃ ┣ 📜App.jsx         # App structure
┃ ┃ ┣ 📜App.test.js     # Unit tests
┃ ┃ ┣ 📜GoogleSignIn.js # Authentication logic
┃ ┃ ┣ 📜index.css       # Global styles
┃ ┃ ┣ 📜index.js        # App entry point
┃ ┃ ┣ 📜logo.svg        # React logo
┃ ┃ ┣ 📜reportWebVitals.js # Performance metrics
┃ ┃ ┣ 📜setupTests.js   # Test environment setup
┃ ┃ ┣ 📜.gitignore      # Untracked files
┃ ┃ ┣ 📜GoogleSignIn.js # Duplicate auth logic
┃ ┃ ┣ 📜README.md       # Client documentation
┃ ┃ ┣ 📜package-lock.json # Dependency lock
┃ ┃ ┣ 📜package.json    # Project dependencies
┃ ┃ ┣ 📜pnpm-lock.yaml  # PNPM lock file
┃ ┃ ┣ 📜pnpm-workspace.yaml # Workspace config
┣ 📂static/             # Server static files
┃ ┣ 📜server.js         # Backend entry
┣ 📂templates/          # HTML templates
┃ ┣ 📜client.js         # Client script
┃ ┣ 📜index.html        # Landing page
┃ ┣ 📜style.css         # Page styling
┣ 📜.env                # Environment and Secret Variables File
┣ 📜.gitignore          # Global ignore rules
┣ 📜CONTRIBUTING.md     # Guidelines
┣ 📜LICENSE             # Licensing info
┣ 📜README.md           # Project docs
┣ 📜SECURITY.md         # Security policy
┣ 📜_redirects          # Netlify/Vercel rules
┣ 📜index.html          # Root HTML
┣ 📜package-lock.json   # NPM lock file
┣ 📜package.json        # Main dependencies
┣ 📜pnpm-lock.yaml      # Lock file
┣ 📜server.js           # Server script
┣ 📜yarn.lock           # Yarn lock file

```
---

## 🖥️ Run Locally
1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/Harsh-Bajpai-1194/Real-Time-Chat-App.git
   cd Real-Time-Chat-App
   npm install
   cd client
   npm install
   ```

2. Start the backend from the project root:
   ```bash
   cd ..
   npm run start
   ```

3. In a second terminal, start the React client:
   ```bash
   cd client
   npm start
   ```

4. The app will be available at:
   ```
   http://localhost:3000
   ```
   and the backend will run on:
   ```
   http://localhost:7777
   ```
5. Don't forget to create this .env file.

   ```
   YOUR_GOOGLE_CLIENT_ID_HERE=GOOGLE_CLIENT_ID.apps.googleusercontent.com
   MONGO_URI=your_mongodb_connection_string
   GITHUB_TOKEN=your_github_token
   PORT=7777
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
