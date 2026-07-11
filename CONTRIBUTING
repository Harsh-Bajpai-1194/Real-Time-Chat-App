# 🤝 Contributing

Thank you for helping improve this project! This repository is designed to support a full-stack Chat Application with automated data tracking, real-time analytics, and a modern MERN-style architecture.

## 🚀 Project Overview

This repo powers a real-time competitive programming leaderboard with:

- MongoDB storage for data, user history, and messages.
- Express API endpoints for message delivery and manual update triggers.
- React frontend with interactive chat rooms and admin controls.

## 🛠️ How to Contribute

### 1. Claim an Issue

1. Browse the Issues tab and find an **unassigned** issue you would like to work on.
2. Comment `/claim` on the issue.
3. Wait for the automated GitHub Actions bot or maintainer to assign the issue to you.

### 2. Fork and Branch

- Fork the repository to your GitHub account.
- Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

### 3. Develop and Test

- Keep changes focused on a single issue or feature.
- Write clean, readable code and follow existing project conventions.
- If applicable, add or update tests for your change.
- Run the backend and frontend locally to verify your work.

### 4. Commit and Push

- Use clear commit messages that describe the change.
- Example:

```bash
git commit -m "Add manual update trigger endpoint"
```

- Push your branch:

```bash
git push origin feature/your-feature-name
```

### 5. Open a Pull Request

- Create a PR against the `main` branch.
- Link the PR to the issue you claimed.
- Include a summary of what changed and any testing notes.
- If the issue is a bug fix, include steps to reproduce the problem and verify the fix.

## 📦 How to run locally (Local Setup)

### Prerequisites

- Node.js v18+ or later
- MongoDB running locally or a MongoDB Atlas connection string
- Google OAuth Client ID if using Google sign-in

### Run the backend

```bash
npm install # From the repo root, install server dependencies
npm run start # Start the backend server that listen on: http://localhost:7777
```

Now, Open a second terminal:-

### Run the frontend

```bash
cd client # Go to the client folder.
npm install # Install frontend dependencies.
npm start # Start the React app.
```

The frontend will open at:-

```bash
http://localhost:3000
```

### Notes

- The frontend uses `http://localhost:7777` to connect to the backend in development.
- If you need to use a custom socket URL, set `REACT_APP_SOCKET_URL` in the client environment.
- If Google sign-in is not configured, you can still join as a guest user.

## 📌 API Endpoints

The project exposes a few core API endpoints for integration and administration:

- `GET /api/leaderboard` — fetch current leaderboard data, badges, and activity feed.
- `POST /api/trigger-update` — manually trigger the GitHub Actions scraper and return a status.
- `POST /api/add-user` — add a new LeetCode handle to the tracker.

## 🧪 Testing and Quality

- Follow existing code style and naming patterns.
- Test both frontend and backend behavior after changes.
- Ensure new functionality does not break current workflows.

## 📈 Release and Version Notes

This project tracks feature maturity through version history. When contributing:

- Mention relevant release notes or roadmap items in your PR if the change belongs to a future milestone.
- Keep the contribution aligned with the current architecture and automation flow.

## 💡 Contribution Best Practices

- Keep changes scoped and incremental.
- Prefer descriptive branch names like `feature/leaderboard-filter` or `fix/activity-graph-bug`.
- Rebase or merge `main` before opening a PR to minimize conflicts.
- If you update documentation, make sure it matches the current behavior.

## 📚 Roadmap and Future Work

This repository is prepared for future enhancements, including:

- Global OAuth authentication for user logins.
- TypeScript migration for stronger type safety.
- Expanded admin controls and classification.

## 🤝 Support

If you want to support development or report a problem:

- Open an issue describing the bug or feature request.
- Provide clear reproduction steps and any relevant logs.
- Use pull requests for code changes and documentation updates.

---

Thank you for contributing! Your improvements help keep the application reliable, fast, and easy to use.
