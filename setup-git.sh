#!/bin/bash

# Baby Name Generator - Git Setup Script
# This script helps you prepare and upload your project to GitHub

echo "🚀 Baby Name Generator - GitHub Setup"
echo "=====================================\n"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

# Check if we're already in a git repository
if [ -d ".git" ]; then
    echo "📁 Git repository already exists."
    read -p "Do you want to continue? (y/n): " continue_choice
    if [ "$continue_choice" != "y" ] && [ "$continue_choice" != "Y" ]; then
        echo "Exiting..."
        exit 0
    fi
else
    echo "📦 Initializing Git repository..."
    git init
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from example..."
    cp env.example .env
    echo "✅ .env file created. Please edit it with your API keys before running the app."
fi

# Add all files to git
echo "📋 Adding files to git..."
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit."
else
    # Commit changes
    echo "💾 Committing changes..."
    git commit -m "Initial commit: Baby Name Generator with Admin Panel

Features:
- AI-powered baby name generation
- Multi-language support (Turkish, English, Arabic, etc.)
- Modern React frontend with routing
- FastAPI backend with JWT authentication
- Admin panel with user management
- Premium subscription features
- Docker support for easy deployment
- Comprehensive documentation"
fi

# Get GitHub repository URL
echo "\n🔗 GitHub Repository Setup"
echo "=========================="
echo "1. Create a new repository on GitHub"
echo "2. Copy the repository URL (e.g., https://github.com/yourusername/baby-name-generator.git)"
echo ""
read -p "Enter your GitHub repository URL: " repo_url

if [ -z "$repo_url" ]; then
    echo "❌ Repository URL is required."
    exit 1
fi

# Add remote origin
echo "🔗 Adding remote origin..."
git remote remove origin 2>/dev/null || true
git remote add origin "$repo_url"

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git branch -M main
git push -u origin main

echo "\n✅ SUCCESS!"
echo "==========="
echo "Your Baby Name Generator project has been uploaded to GitHub!"
echo ""
echo "Next steps:"
echo "1. Update the README.md file with your actual GitHub username"
echo "2. Configure your .env file with real API keys"
echo "3. Set up GitHub Actions for CI/CD (optional)"
echo "4. Deploy to your preferred hosting platform"
echo ""
echo "Repository URL: $repo_url"
echo ""
echo "Admin Panel Access:"
echo "- URL: http://localhost:5174/admin"
echo "- Email: admin@babynamer.com"
echo "- Password: admin123"
echo ""
echo "Happy coding! 🎉" 