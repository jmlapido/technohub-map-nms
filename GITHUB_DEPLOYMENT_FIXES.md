# GitHub Deployment Fixes

This document summarizes the fixes applied to ensure the codebase is ready for GitHub deployment.

## Issues Fixed

### 1. ✅ Hardcoded Domain in Docker Compose
**Problem:** `docker-compose.yml` had a hardcoded domain `https://map.jmlapido.com`
**Fix:** Changed to use environment variable with fallback:
```yaml
- NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-}
```
**Impact:** Now configurable via `.env` file or environment variable. If not set, the frontend will auto-detect the API URL.

### 2. ✅ Sensitive Data in Repository
**Problem:** `backend/data/` directory contains sensitive runtime data:
- `auth.json` - Contains passwords
- `sessions.json` - Contains session data
- `config.json` - Contains production configuration with private IPs
- `database.sqlite` - Contains runtime database
- `backup-*/` - Contains backup data

**Fix:** Updated `.gitignore` to explicitly exclude all `backend/data/` contents:
```
backend/data/**/*
!backend/data/.gitkeep
backend/data/auth.json
backend/data/sessions.json
backend/data/config.json
backend/data/database.sqlite
backend/data/backup-*/
```

**Note:** If these files are already tracked by Git, you'll need to remove them:
```bash
git rm --cached backend/data/*.json backend/data/database.sqlite
git rm -r --cached backend/data/backup-*
```

### 3. ✅ Database Files Not Ignored
**Problem:** Database files and journal files might be accidentally committed
**Fix:** Added explicit exclusions for all SQLite file types:
```
backend/database.sqlite
backend/database.sqlite-journal
backend/database.sqlite-wal
backend/database.sqlite-shm
```

### 4. ✅ Docker Build Includes Sensitive Data
**Problem:** `.dockerignore` didn't exclude `backend/data/` directory
**Fix:** Added exclusion pattern:
```
backend/data/**/*
!backend/data/.gitkeep
```
**Impact:** Sensitive runtime data won't be included in Docker builds.

### 5. ✅ Missing Environment Variable Documentation
**Problem:** No documentation for environment variables
**Fix:** Created `ENVIRONMENT_VARIABLES.md` with complete documentation

## Files Modified

1. `docker-compose.yml` - Changed hardcoded domain to environment variable
2. `.gitignore` - Enhanced to exclude all sensitive data
3. `.dockerignore` - Added backend/data exclusion
4. `ENVIRONMENT_VARIABLES.md` - New file documenting environment variables
5. `GITHUB_DEPLOYMENT_FIXES.md` - This file

## Pre-Deployment Checklist

Before pushing to GitHub, ensure:

- [ ] Run `git status` to check what files are staged
- [ ] Verify no sensitive files are being committed:
  ```bash
  git status | grep -E "(auth.json|sessions.json|database.sqlite|config.json)"
  ```
- [ ] If sensitive files show up, remove them from Git tracking:
  ```bash
  git rm --cached backend/data/auth.json
  git rm --cached backend/data/sessions.json
  git rm --cached backend/data/config.json
  git rm --cached backend/data/database.sqlite
  ```
- [ ] Create a `.env.example` file (optional but recommended):
  ```bash
  echo "NEXT_PUBLIC_API_URL=" > .env.example
  ```
- [ ] Test Docker build locally:
  ```bash
  docker compose build
  ```

## Important Notes

### ⚠️ Security Warnings

1. **Never commit:**
   - `backend/data/auth.json` (contains passwords)
   - `backend/data/sessions.json` (contains session tokens)
   - `backend/data/config.json` (contains production config with private IPs)
   - `backend/data/database.sqlite` (contains runtime data)
   - Any `.env` files with actual credentials

2. **The `backend/config.json` in the root directory** is safe to commit - it contains sample/default configuration.

3. **The `backend/data/config.json`** should NEVER be committed - it's runtime/production data.

### Configuration Flow

1. **Default Config:** `backend/config.json` (committed to Git)
2. **Runtime Config:** `backend/data/config.json` (NOT committed, created at runtime)
3. **Docker Entrypoint:** Copies default config to data directory if it doesn't exist

### Environment Variables

For production deployment with a custom domain:
1. Create `.env` file (do NOT commit this):
   ```bash
   NEXT_PUBLIC_API_URL=https://your-domain.com
   ```
2. Or set when running Docker:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-domain.com docker compose up
   ```

## Verification Steps

After fixing, verify:

1. **Check Git Status:**
   ```bash
   git status
   # Should NOT show backend/data/*.json or database.sqlite
   ```

2. **Test Docker Build:**
   ```bash
   docker compose build
   # Should complete without errors
   ```

3. **Verify .gitignore:**
   ```bash
   git check-ignore backend/data/auth.json
   # Should output: backend/data/auth.json
   ```

## Next Steps

1. Review the changes:
   ```bash
   git diff
   ```

2. Stage the fixes:
   ```bash
   git add docker-compose.yml .gitignore .dockerignore ENVIRONMENT_VARIABLES.md
   ```

3. Commit:
   ```bash
   git commit -m "Fix GitHub deployment issues: remove hardcoded domain, exclude sensitive data"
   ```

4. Push to GitHub:
   ```bash
   git push origin main
   ```

