"""
Detect Smart Folders Script
----------------------------
Scans immediate subdirectories of a target folder and identifies ones that
appear to be well-organized or self-contained (e.g., git repositories,
software projects, macOS app bundles). These folders should be moved to
an 'Others/' directory instead of being broken apart during organization.
"""

import os
import sys
import json

# Marker files/directories that indicate a self-contained project
PROJECT_MARKERS = {
    # Node/JS ecosystem
    "package.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "package-lock.json",
    "angular.json",
    "tsconfig.json",
    "next.config.js",
    "vite.config.js",
    "webpack.config.js",
    # Python ecosystem
    "pyproject.toml",
    "setup.py",
    "requirements.txt",
    "tox.ini",
    "manage.py",
    "pytest.ini",
    # Other ecosystems
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "Gemfile",
    "composer.json",
    ".sln",
    "pubspec.yaml",
    "mix.exs",
    # Build & Config
    "Makefile",
    "CMakeLists.txt",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    "Vagrantfile",
    "Rakefile",
    "main.tf",
    # Installers
    "install.sh",
    "install.bat",
    "setup.sh",
    "configure",
    "Makefile.am",
    "Makefile.in",
    "install.ps1",
}

# Directories that signal a project or app structure
PROJECT_DIRS = {
    # Version control
    ".git",
    ".svn",
    ".hg",
    ".bzr",
    ".cvs",
    # Package environments
    "node_modules",
    "venv",
    ".venv",
    # IDEs & Workspaces
    ".xcodeproj",
    ".xcworkspace",
    ".vscode",
    ".idea",
    ".fleet",
    # Tools
    ".terraform",
}

# Folders created by the organizer itself — skip these
SKIP_FOLDERS = {
    "to_remove",
    "Photos",
    "Videos",
    "Installers",
    "Archives",
    "Invoices",
    "Bills",
    "Receipts",
    "Travel",
    "Documents",
    "Misc",
    "Others",
}


def is_app_bundle(name):
    """Check if the directory name looks like a macOS .app bundle."""
    return name.endswith(".app")


def detect_smart_folders(directory):
    """
    Scans immediate children of `directory` and returns a list of
    subdirectories that appear to be well-organized or self-contained.
    """
    smart_folders = []

    try:
        entries = os.listdir(directory)
    except OSError:
        return smart_folders

    for entry in sorted(entries):
        entry_path = os.path.join(directory, entry)

        # Only inspect directories
        if not os.path.isdir(entry_path):
            continue

        # Skip organizer-created folders
        if entry in SKIP_FOLDERS:
            continue

        # Skip hidden directories (except we still check for .git inside children)
        if entry.startswith("."):
            continue

        reason = None

        # Check for macOS app bundles
        if is_app_bundle(entry):
            reason = "macOS app bundle"

        # Check for project marker files
        if reason is None:
            try:
                children = os.listdir(entry_path)
            except OSError:
                continue

            children_lower = {c.lower() for c in children}

            for marker in PROJECT_MARKERS:
                if marker.lower() in children_lower:
                    reason = f"contains {marker}"
                    break

        # Check for project marker directories
        if reason is None:
            for marker_dir in PROJECT_DIRS:
                candidate = os.path.join(entry_path, marker_dir)
                # Some markers like .xcodeproj are suffix-matched
                if marker_dir.startswith(".xc"):
                    if any(
                        c.endswith(marker_dir)
                        for c in children
                        if os.path.isdir(os.path.join(entry_path, c))
                    ):
                        reason = f"contains {marker_dir}"
                        break
                elif os.path.isdir(candidate):
                    reason = f"contains {marker_dir}/ directory"
                    break

        if reason:
            smart_folders.append({"path": entry, "reason": reason})

    return smart_folders


if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    results = detect_smart_folders(target_dir)
    print(json.dumps(results, indent=2))
