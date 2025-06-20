#!/bin/bash

# Quick GitHub Update Script
# Use: ./quick-update.sh "Your commit message"

echo "🚀 GitHub Quick Update"
echo "====================="

# Check if commit message provided
if [ -z "$1" ]; then
    echo "❌ Commit mesajı gerekli!"
    echo "Kullanım: ./quick-update.sh \"Değişiklik açıklaması\""
    exit 1
fi

# Show changes
echo "📋 Değişen dosyalar:"
git status --short

# Ask for confirmation
read -p "Bu değişiklikleri GitHub'a göndermek istiyor musun? (y/n): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "İptal edildi."
    exit 0
fi

# Add all changes
echo "📦 Dosyalar ekleniyor..."
git add .

# Commit changes
echo "💾 Commit yapılıyor..."
git commit -m "$1"

# Push to GitHub
echo "🚀 GitHub'a gönderiliyor..."
git push

echo "✅ Başarıyla güncellendi!"
echo "📍 Repository: https://github.com/Yigittalha/babyA-" 