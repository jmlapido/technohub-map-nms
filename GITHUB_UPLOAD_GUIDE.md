# GitHub Upload Guide

This guide will help you upload the Map-Ping project to GitHub.

## Prerequisites

- Git installed on your system
- GitHub account
- GitHub repository created (or we'll create one)

## Step 1: Create a GitHub Repository

### Option A: Create via GitHub Website

1. Go to https://github.com/new
2. Enter repository name: `map-ping`
3. Choose visibility: Public or Private
4. **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

### Option B: Create via GitHub CLI

```bash
# Install GitHub CLI first if not installed
# Windows: winget install --id GitHub.cli
# macOS: brew install gh
# Linux: See https://cli.github.com/

# Login to GitHub
gh auth login

# Create repository
gh repo create map-ping --public --source=. --remote=origin --push
```

## Step 2: Prepare Your Files

The following files are ready to be committed:

### New Docker Files
- `Dockerfile` - Multi-stage Docker build configuration
- `docker-compose.yml` - Docker Compose orchestration
- `docker-entrypoint.sh` - Container startup script
- `.dockerignore` - Docker build exclusions
- `DOCKER_README.md` - Docker deployment documentation
- `DEPLOYMENT.md` - Comprehensive deployment guide

### GitHub Actions Workflows
- `.github/workflows/docker-build.yml` - Automated Docker builds
- `.github/workflows/docker-test.yml` - Docker testing workflow

### Updated Files
- `.gitignore` - Added Docker-related exclusions

## Step 3: Commit and Push to GitHub

### Using Command Line

```bash
# Stage all new and modified files
git add .

# Commit with descriptive message
git commit -m "Add Docker deployment configuration and GitHub Actions workflows

- Add multi-stage Dockerfile for optimized production builds
- Add docker-compose.yml for easy deployment
- Add Docker documentation (DOCKER_README.md)
- Add comprehensive deployment guide (DEPLOYMENT.md)
- Add GitHub Actions for automated Docker builds and testing
- Update .gitignore for Docker files"

# Push to GitHub
git push origin main
```

### Using GitHub Desktop (GUI)

1. Open GitHub Desktop
2. Click "File" > "Add Local Repository"
3. Select the map-ping folder
4. Review the changes in the left panel
5. Write commit message: "Add Docker deployment configuration and GitHub Actions workflows"
6. Click "Commit to main"
7. Click "Push origin" button

## Step 4: Verify Upload

After pushing, verify your files on GitHub:

1. Go to https://github.com/YOUR_USERNAME/map-ping
2. Check that all files are present
3. Verify the Docker files are in the root directory
4. Check that GitHub Actions workflows are in `.github/workflows/`

## Step 5: Enable GitHub Actions

1. Go to your repository on GitHub
2. Click "Actions" tab
3. If prompted, click "I understand my workflows, go ahead and enable them"
4. The workflows will automatically run on the next push

## Step 6: Enable GitHub Container Registry (Optional)

To automatically build and publish Docker images:

1. Go to repository Settings
2. Click "Actions" > "General"
3. Scroll to "Workflow permissions"
4. Select "Read and write permissions"
5. Click "Save"

## Step 7: Access Your Docker Image

After the GitHub Actions workflow completes:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Pull your image
docker pull ghcr.io/YOUR_USERNAME/map-ping:latest

# Run the container
docker run -d -p 4000:4000 -p 5000:5000 ghcr.io/YOUR_USERNAME/map-ping:latest
```

## Alternative: Push to Docker Hub

If you prefer Docker Hub instead of GitHub Container Registry:

```bash
# Build the image
docker build -t YOUR_DOCKERHUB_USERNAME/map-ping:latest .

# Login to Docker Hub
docker login

# Push the image
docker push YOUR_DOCKERHUB_USERNAME/map-ping:latest
```

## Troubleshooting

### Authentication Issues

If you get authentication errors:

```bash
# Generate a Personal Access Token
# Go to: https://github.com/settings/tokens
# Create token with 'repo' and 'write:packages' scopes

# Use token for authentication
git remote set-url origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/map-ping.git
```

### Large File Issues

If you have large files:

```bash
# Check file sizes
git ls-files | xargs ls -la | sort -k5 -rn | head

# Add large files to .gitignore if needed
echo "large-file.bin" >> .gitignore
git rm --cached large-file.bin
```

### Merge Conflicts

If you have merge conflicts:

```bash
# Pull latest changes
git pull origin main

# Resolve conflicts manually
# Then commit and push
git add .
git commit -m "Resolve merge conflicts"
git push origin main
```

## Next Steps

After uploading to GitHub:

1. **Set up GitHub Pages** (optional) - Host documentation
2. **Configure branch protection** - Protect main branch
3. **Add collaborators** - Invite team members
4. **Set up issues and projects** - Track bugs and features
5. **Create releases** - Tag stable versions

## Quick Reference

```bash
# Check status
git status

# Add files
git add .

# Commit
git commit -m "Your commit message"

# Push
git push origin main

# Pull latest
git pull origin main

# Create new branch
git checkout -b feature-name

# Switch branches
git checkout branch-name

# Merge branch
git checkout main
git merge feature-name
```

## Support

If you encounter issues:
- Check [Git Documentation](https://git-scm.com/doc)
- Check [GitHub Documentation](https://docs.github.com)
- Review [GitHub Actions Documentation](https://docs.github.com/en/actions)

## License

Make sure to include a LICENSE file in your repository. Common choices:
- MIT License
- Apache 2.0
- GPL v3

To add a license:
```bash
# Create LICENSE file
touch LICENSE

# Add license text (copy from https://choosealicense.com/)
# Then commit
git add LICENSE
git commit -m "Add LICENSE"
git push origin main
```

