# Romfordeling

## Deploy (frontend + backend)

This setup uses GitHub Pages for the frontend and Render for the backend.

### 1) Backend (Render)
1. Create a GitHub repo and push this project.
2. Go to https://render.com/ and choose **New +** -> **Web Service**.
3. Select your repo.
4. Set:
   - Build Command: `./gradlew build -x test`
   - Start Command: `java -jar build/libs/romfordeling-0.0.1-SNAPSHOT.jar`
5. Deploy.
6. Copy the backend URL (example: `https://romfordeling.onrender.com`).

Note: If Render does not support Java 25, change `build.gradle` to Java 21 and redeploy.

### 2) Frontend (GitHub Pages)
1. Set `docs/config.js` to your backend URL:
   ```js
   window.API_BASE = "https://YOUR-RENDER-APP.onrender.com";
   ```
2. Commit and push.
3. In GitHub: Settings -> Pages -> Deploy from a branch.
4. Choose `main` and `/docs`.
5. Wait for the page to publish, then open the GitHub Pages URL.

## Local run
- Backend + frontend together: `gradlew.bat bootRun`
- Open `http://localhost:8080`
