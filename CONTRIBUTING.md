# 🤝 Contributing

Thank you for helping improve this project! This repository is designed to support a full-stack leaderboard system with automated data tracking, real-time analytics, and a modern MERN-style architecture.

## 🚀 Project Overview

This repo powers a real-time competitive programming leaderboard with:

- Automated daily scraping and synchronization using GitHub Actions and Python.
- MongoDB storage for leaderboard data, user history, and activity graphs.
- Express API endpoints for leaderboard delivery and manual update triggers.
- React frontend with interactive progress charts and admin controls.

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

## 📦 Local Setup

### Prerequisites

- Node.js v18+
- Python 3.9+
- MongoDB Atlas account or local MongoDB instance
- GitHub Personal Access Token with `workflow` scope (if working with GitHub Actions automation)

### Backend Setup

1. Create a `.env` file in the repo root:

```env
YOUR_GOOGLE_CLIENT_ID_HERE=your_google_client_id_string
MONGO_URI=your_mongodb_connection_string
GITHUB_TOKEN=your_github_token
PORT=7777
```

2. Install dependencies and start the server:

```bash
npm install
node server.js
```

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd client
```

2. Install dependencies and start the app:

```bash
npm install
npm run dev
```

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
- Expanded admin controls and automated badge classification.

## 🤝 Support

If you want to support development or report a problem:

- Open an issue describing the bug or feature request.
- Provide clear reproduction steps and any relevant logs.
- Use pull requests for code changes and documentation updates.

---

Thank you for contributing! Your improvements help keep the leaderboard reliable, fast, and easy to use.
