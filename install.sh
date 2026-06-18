#!/bin/bash

# LiteLLM Chat Installer
# Run with: curl -fsSL https://raw.githubusercontent.com/KailynBrown-KR/litellm-chat/master/install.sh | bash

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🚀 LiteLLM Chat Installer                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Define installation directory
INSTALL_DIR="$HOME/LiteLLM-Chat"
APP_NAME="LiteLLM Chat"
REPO_URL="https://github.com/KailynBrown-KR/litellm-chat.git"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This installer is designed for macOS only."
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check for Xcode Command Line Tools
echo "📋 Checking for Xcode Command Line Tools..."
if ! xcode-select -p &>/dev/null; then
    echo "📦 Installing Xcode Command Line Tools..."
    echo "   A popup may appear - click 'Install' to proceed."
    xcode-select --install
    echo ""
    echo "⏳ Please wait for the Xcode tools installation to complete,"
    echo "   then run this installer again."
    exit 0
else
    echo "✅ Xcode Command Line Tools already installed"
fi

# Step 2: Check for Homebrew
echo ""
echo "📋 Checking for Homebrew..."
if ! command_exists brew; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    echo "✅ Homebrew installed"
else
    echo "✅ Homebrew already installed"
fi

# Step 3: Check for Node.js
echo ""
echo "📋 Checking for Node.js..."
if ! command_exists node; then
    echo "📦 Installing Node.js..."
    brew install node
    echo "✅ Node.js installed"
else
    echo "✅ Node.js already installed ($(node --version))"
fi

# Step 4: Check for Git
echo ""
echo "📋 Checking for Git..."
if ! command_exists git; then
    echo "📦 Installing Git..."
    brew install git
    echo "✅ Git installed"
else
    echo "✅ Git already installed"
fi

# Step 5: Clone or update the repository
echo ""
echo "📋 Setting up LiteLLM Chat..."
if [ -d "$INSTALL_DIR" ]; then
    echo "📂 Directory already exists, updating..."
    cd "$INSTALL_DIR"
    git pull origin master 2>/dev/null || git pull origin main 2>/dev/null || true
else
    echo "📥 Downloading LiteLLM Chat..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
echo "✅ LiteLLM Chat downloaded to $INSTALL_DIR"

# Step 6: Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"

# Step 7: Make start script executable
chmod +x start-server.sh

# Step 8: Create the macOS app
echo ""
echo "🎨 Creating LiteLLM Chat app..."

# Create Applications directory if it doesn't exist
mkdir -p "$HOME/Applications"

# Create the AppleScript
cat > /tmp/LiteLLMChat.applescript << 'APPLESCRIPT'
on run
    set scriptPath to (system attribute "HOME") & "/LiteLLM-Chat/start-server.sh"
    
    tell application "Terminal"
        activate
        do script scriptPath
    end tell
end run
APPLESCRIPT

# Compile to app
osacompile -o "$HOME/Applications/$APP_NAME.app" /tmp/LiteLLMChat.applescript
rm /tmp/LiteLLMChat.applescript

# Apply custom icon if it exists
if [ -f "$INSTALL_DIR/LiteLLM-logo.icns" ]; then
    echo "🎨 Applying custom icon..."
    
    # Copy to app bundle
    cp "$INSTALL_DIR/LiteLLM-logo.icns" "$HOME/Applications/$APP_NAME.app/Contents/Resources/applet.icns"
    
    # Create AppleScript to set icon using NSWorkspace
    cat > /tmp/seticon.scpt << SETICON
use framework "AppKit"

set iconPath to "$INSTALL_DIR/LiteLLM-logo.icns"
set appPath to "$HOME/Applications/$APP_NAME.app"

set iconImage to current application's NSImage's alloc()'s initWithContentsOfFile:iconPath
current application's NSWorkspace's sharedWorkspace()'s setIcon:iconImage forFile:appPath options:0
SETICON
    
    # Run the AppleScript
    osascript /tmp/seticon.scpt 2>/dev/null || true
    rm -f /tmp/seticon.scpt
    
    # Touch the app to refresh
    touch "$HOME/Applications/$APP_NAME.app"
    
    echo "✅ Custom icon applied"
fi

echo "✅ App created at ~/Applications/$APP_NAME.app"

# Step 9: Save config pointing to install directory
echo "$INSTALL_DIR" > "$HOME/.node-server-config"

# Done!
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ✅ Installation Complete!                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 LiteLLM Chat is installed at: $INSTALL_DIR"
echo "📍 App is at: ~/Applications/$APP_NAME.app"
echo ""
echo "🚀 To start using LiteLLM Chat:"
echo "   1. Open Finder"
echo "   2. Press ⌘+Shift+G and type: ~/Applications"
echo "   3. Double-click 'LiteLLM Chat'"
echo ""
echo "   Or drag it to your Dock for easy access!"
echo ""
echo "📝 The first time you run it, you'll be asked for:"
echo "   • Your API URL (e.g., https://api.openai.com/v1)"
echo "   • Your API Key"
echo ""

# Optionally open the Applications folder
read -p "Would you like to open the Applications folder now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "$HOME/Applications"
fi

echo "Enjoy! 🎉"