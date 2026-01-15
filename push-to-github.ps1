# GitHub Push Script for Cycles Project
# Run this script after creating your GitHub repository

Write-Host "=== Cycles Project - GitHub Push Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if git is installed
try {
    git --version | Out-Null
    Write-Host "✓ Git is installed" -ForegroundColor Green
} catch {
    Write-Host "✗ Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Before running this script, make sure you have:" -ForegroundColor Yellow
Write-Host "1. Created a repository on GitHub" -ForegroundColor Yellow
Write-Host "2. Copied the repository URL" -ForegroundColor Yellow
Write-Host ""

# Get GitHub repository URL from user
$repoUrl = Read-Host "Enter your GitHub repository URL (e.g., https://github.com/username/cycles.git)"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "✗ Repository URL is required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting Git operations..." -ForegroundColor Cyan

# Navigate to project directory
Set-Location -Path $PSScriptRoot

# Check if .git exists
if (Test-Path ".git") {
    Write-Host "✓ Git repository already initialized" -ForegroundColor Green
} else {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Git repository initialized" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to initialize Git repository" -ForegroundColor Red
        exit 1
    }
}

# Check for uncommitted changes
Write-Host ""
Write-Host "Staging all files..." -ForegroundColor Yellow
git add .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Files staged successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to stage files" -ForegroundColor Red
    exit 1
}

# Create commit
Write-Host ""
Write-Host "Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Cycles app with frontend and backend"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Commit created successfully" -ForegroundColor Green
} else {
    Write-Host "⚠ Commit may have failed or no changes to commit" -ForegroundColor Yellow
}

# Set main branch
Write-Host ""
Write-Host "Setting main branch..." -ForegroundColor Yellow
git branch -M main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Main branch set" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to set main branch" -ForegroundColor Red
    exit 1
}

# Check if remote already exists
$existingRemote = git remote get-url origin 2>$null

if ($existingRemote) {
    Write-Host ""
    Write-Host "Remote 'origin' already exists: $existingRemote" -ForegroundColor Yellow
    $updateRemote = Read-Host "Do you want to update it? (y/n)"
    
    if ($updateRemote -eq 'y' -or $updateRemote -eq 'Y') {
        git remote remove origin
        git remote add origin $repoUrl
        Write-Host "✓ Remote updated" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "Adding remote repository..." -ForegroundColor Yellow
    git remote add origin $repoUrl
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Remote added successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to add remote" -ForegroundColor Red
        exit 1
    }
}

# Push to GitHub
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "You may be prompted for your GitHub credentials..." -ForegroundColor Cyan
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Verify your code on GitHub: $repoUrl" -ForegroundColor White
    Write-Host "2. Deploy backend to Render" -ForegroundColor White
    Write-Host "3. Deploy frontend to Netlify" -ForegroundColor White
    Write-Host ""
    Write-Host "See DEPLOYMENT_GUIDE.md for detailed instructions" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "✗ Failed to push to GitHub" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "- Authentication required: Use GitHub Personal Access Token" -ForegroundColor White
    Write-Host "- Repository doesn't exist: Create it on GitHub first" -ForegroundColor White
    Write-Host "- Network issues: Check your internet connection" -ForegroundColor White
    exit 1
}
