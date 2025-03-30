// Sample data
const files = [
  { id: "1", name: "Documents", type: "folder", modified: "Mar 25, 2025" },
  { id: "2", name: "Projects", type: "folder", modified: "Mar 28, 2025" },
  { id: "3", name: "Photos", type: "folder", modified: "Mar 29, 2025" },
  { id: "4", name: "vacation.jpg", type: "image", modified: "Mar 15, 2025" },
  { id: "5", name: "report.docx", type: "document", modified: "Mar 20, 2025" },
  {
    id: "6",
    name: "budget.xlsx",
    type: "spreadsheet",
    modified: "Mar 22, 2025",
  },
  { id: "7", name: "app.js", type: "code", modified: "Mar 24, 2025" },
  { id: "8", name: "notes.txt", type: "other", modified: "Mar 26, 2025" },
  { id: "9", name: "profile.png", type: "image", modified: "Mar 27, 2025" },
  {
    id: "10",
    name: "presentation.pptx",
    type: "document",
    modified: "Mar 30, 2025",
  },
];

// DOM Elements
const menuToggle = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
const closeSidebar = document.getElementById("close-sidebar");
const overlay = document.getElementById("sidebar-overlay");
const uploadButton = document.querySelector(".upload-button");
const fileUploadInput = document.getElementById("file-upload");
const myDriveFilesContainer = document.getElementById("my-drive-files");
const recentFilesContainer = document.getElementById("recent-files");

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  // Render files
  renderFiles(myDriveFilesContainer, files);
  renderFiles(recentFilesContainer, files.slice(0, 5));

  // Setup event listeners
  setupEventListeners();
});

// Render files in a container
function renderFiles(container, filesList) {
  container.innerHTML = "";

  filesList.forEach((file) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.dataset.id = file.id;

    const icon = getFileIcon(file.type);

    fileItem.innerHTML = `
            <div class="file-content">
                <i class="file-icon ${icon}"></i>
                <div class="file-name">${file.name}</div>
                <div class="file-date">${file.modified}</div>
            </div>
            <button class="file-menu-button">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        `;

    container.appendChild(fileItem);
  });
}

// Get icon class based on file type
function getFileIcon(type) {
  switch (type) {
    case "folder":
      return "fas fa-folder folder-icon";
    case "image":
      return "fas fa-image image-icon";
    case "document":
      return "fas fa-file-alt document-icon";
    case "spreadsheet":
      return "fas fa-file-excel spreadsheet-icon";
    case "code":
      return "fas fa-file-code code-icon";
    default:
      return "fas fa-file other-icon";
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Mobile menu toggle
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.style.display = "block";
  });

  // Close sidebar
  closeSidebar.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.style.display = "none";
  });

  // Overlay click
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.style.display = "none";
  });

  // File menu buttons
  document.addEventListener("click", handleFileMenuClick);

  // Handle context menu closing when clicking elsewhere
  document.addEventListener("click", (e) => {
    const activeMenu = document.querySelector(
      '.context-menu:not([style*="display: none"])'
    );
    if (
      activeMenu &&
      !activeMenu.contains(e.target) &&
      !e.target.classList.contains("file-menu-button")
    ) {
      activeMenu.style.display = "none";
    }
  });

  // Upload button click
  uploadButton.addEventListener("click", () => {
    fileUploadInput.click();
  });

  // File upload change
  fileUploadInput.addEventListener("change", handleFileUpload);
}

// Handle file menu button clicks
function handleFileMenuClick(e) {
  const menuButton = e.target.closest(".file-menu-button");

  if (!menuButton) return;

  e.stopPropagation();

  // Hide any open menus
  const openMenus = document.querySelectorAll(
    '.context-menu:not([style*="display: none"])'
  );
  openMenus.forEach((menu) => (menu.style.display = "none"));

  // Get file item
  const fileItem = menuButton.closest(".file-item");
  const fileId = fileItem.dataset.id;

  // Clone the template menu
  const template = document.getElementById("context-menu-template");
  const contextMenu = template.cloneNode(true);
  contextMenu.id = "";
  contextMenu.style.display = "block";

  // Position the menu
  const rect = menuButton.getBoundingClientRect();
  contextMenu.style.top = `${rect.bottom + window.scrollY}px`;
  contextMenu.style.left = `${rect.left + window.scrollX}px`;

  // Add event listeners to menu items
  const menuItems = contextMenu.querySelectorAll("li");
  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      handleMenuAction(item.textContent.toLowerCase(), fileId);
      contextMenu.style.display = "none";
    });
  });

  // Add to document
  document.body.appendChild(contextMenu);
}

// Handle menu actions
function handleMenuAction(action, fileId) {
  const file = files.find((f) => f.id === fileId);

  switch (action) {
    case "rename":
      // Implement rename functionality
      const newName = prompt("Enter new name:", file.name);
      if (newName && newName.trim() !== "") {
        file.name = newName.trim();
        // Re-render files
        renderFiles(myDriveFilesContainer, files);
        renderFiles(recentFilesContainer, files.slice(0, 5));
      }
      break;
    case "download":
      // Implement download functionality
      alert(`Downloading ${file.name}...`);
      break;
    case "share":
      // Implement share functionality
      alert(`Sharing options for ${file.name}`);
      break;
    case "delete":
      // Implement delete functionality
      if (confirm(`Are you sure you want to delete ${file.name}?`)) {
        const index = files.findIndex((f) => f.id === fileId);
        if (index !== -1) {
          files.splice(index, 1);
          // Re-render files
          renderFiles(myDriveFilesContainer, files);
          renderFiles(recentFilesContainer, files.slice(0, 5));
        }
      }
      break;
  }
}

// Handle file upload
function handleFileUpload(e) {
  const uploadedFiles = e.target.files;

  if (uploadedFiles.length === 0) return;

  // Create file objects and add to data
  Array.from(uploadedFiles).forEach((file) => {
    // Generate new ID
    const newId = (
      Math.max(...files.map((f) => parseInt(f.id))) + 1
    ).toString();

    // Determine file type
    let type = "other";
    if (file.name.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i)) {
      type = "image";
    } else if (file.name.match(/\.(doc|docx|pdf|txt|rtf)$/i)) {
      type = "document";
    } else if (file.name.match(/\.(xls|xlsx|csv)$/i)) {
      type = "spreadsheet";
    } else if (file.name.match(/\.(js|py|java|html|css|c|cpp|php)$/i)) {
      type = "code";
    }

    // Create new file object
    const newFile = {
      id: newId,
      name: file.name,
      type: type,
      modified: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      // Store the actual file data for future use
      fileData: file,
    };

    // Add to files array
    files.unshift(newFile);
  });

  // Re-render files
  renderFiles(myDriveFilesContainer, files);
  renderFiles(recentFilesContainer, files.slice(0, 5));

  // Reset the input
  fileUploadInput.value = "";
}
