// Initialize Supabase
const SUPABASE_URL = "https://cspjbqypspcpojibljrl.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzcGpicXlwc3BjcG9qaWJsanJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzMjM0NjYsImV4cCI6MjA1ODg5OTQ2Nn0.QAEyQ_ToPbERKjinEfKl8kSvjH8WdStVsR-4TPN9WXA";

// Global Supabase client variable
let supabase;

// DOM Elements
const fileUploadBtn = document.getElementById("upload-btn");
const fileUploadInput = document.getElementById("file-upload");
const filesContainer = document.getElementById("files-container");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const sidebar = document.querySelector(".sidebar");
const createFolderBtn = document.getElementById("create-folder-btn");
const currentPathEl = document.getElementById("current-path");

// State
let currentFolderId = null;
let folderPath = [{ id: null, name: "My Drive" }];
let storageUsed = 0;

// Initialize the app
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // First, load the Supabase library
    await loadSupabaseScript();

    // Now we can create the client
    supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase loaded successfully");

    // Add event listeners
    fileUploadBtn.addEventListener("click", () => fileUploadInput.click());
    fileUploadInput.addEventListener("change", handleFileUpload);
    toggleSidebarBtn.addEventListener("click", toggleSidebar);
    createFolderBtn.addEventListener("click", createFolder);

    // Create sidebar overlay for mobile
    const overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    overlay.addEventListener("click", toggleSidebar);
    document.body.appendChild(overlay);

    // Load files
    await loadFiles();

    // Update storage info
    await updateStorageInfo();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    alert(
      "Failed to initialize the application. Please refresh and try again."
    );
  }
});

// Function to load Supabase script
function loadSupabaseScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load Supabase library"));
    document.head.appendChild(script);
  });
}

// Function to create Supabase client
function createSupabaseClient(url, key) {
  // At this point, the Supabase library is loaded and the global supabase object is available
  return window.supabase.createClient(url, key);
}

// Toggle sidebar on mobile
function toggleSidebar() {
  sidebar.classList.toggle("active");
  document.querySelector(".sidebar-overlay").classList.toggle("active");
}

// Create a new folder
async function createFolder() {
  const folderName = prompt("Enter folder name:");
  if (!folderName || folderName.trim() === "") return;

  try {
    const { data, error } = await supabase
      .from("files")
      .insert({
        name: folderName.trim(),
        type: "folder",
        parent_id: currentFolderId,
        size: 0,
      })
      .select();

    if (error) throw error;

    await loadFiles();
  } catch (error) {
    console.error("Error creating folder:", error);
    alert("Failed to create folder. Please try again.");
  }
}

// Handle file upload
async function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  // Get logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    alert("You must be logged in to upload files.");
    return;
  }
  const userId = user.id;

  // Show loading indicator
  filesContainer.innerHTML = '<div class="loading">Uploading files...</div>';

  for (const file of files) {
    try {
      // Upload file to Supabase Storage
      const filePath = `uploads/${userId}/${Date.now()}_${file.name}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from("drive-files")
        .upload(filePath, file);

      if (storageError) throw storageError;

      // Determine file type
      let type = "other";
      if (file.name.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i)) type = "image";
      else if (file.name.match(/\.(doc|docx|pdf|txt|rtf)$/i)) type = "document";
      else if (file.name.match(/\.(xls|xlsx|csv)$/i)) type = "spreadsheet";
      else if (file.name.match(/\.(js|py|java|html|css|c|cpp|php)$/i))
        type = "code";

      // Add file record to database (with user ID)
      const { data, error } = await supabase
        .from("files")
        .insert({
          user_id: userId, // Associate file with user
          name: file.name,
          type,
          size: file.size,
          path: filePath,
          parent_id: currentFolderId,
        })
        .select();

      if (error) throw error;
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  }

  // Reset file input and reload files
  fileUploadInput.value = "";
  await loadFiles();
  await updateStorageInfo();
}

// Load files from current folder
async function loadFiles() {
  try {
    filesContainer.innerHTML = '<div class="loading">Loading files...</div>';

    // Get logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to view files.");
      return;
    }

    let query = supabase
      .from("files")
      .select("*")
      .eq("user_id", user.id) // Fetch only the logged-in user's files
      .order("type")
      .order("name");

    if (currentFolderId === null) {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", currentFolderId);
    }

    const { data, error } = await query;

    if (error) throw error;

    renderFiles(data || []);
  } catch (error) {
    console.error("Error loading files:", error);
    filesContainer.innerHTML =
      '<div class="loading">Error loading files. Please refresh.</div>';
  }
}

// Render files to the container
function renderFiles(files) {
  if (files.length === 0) {
    filesContainer.innerHTML =
      '<div class="loading">No files in this folder.</div>';
    return;
  }

  filesContainer.innerHTML = "";

  files.forEach((file) => {
    const fileEl = document.createElement("div");
    fileEl.className = "file-item";

    // Format date and get icon based on type
    const date = new Date(file.modified_at || file.created_at);
    const formattedDate = date.toLocaleDateString();
    let iconClass =
      file.type === "folder"
        ? "fa-folder"
        : file.type === "image"
        ? "fa-file-image"
        : "fa-file";

    fileEl.innerHTML = `
      <div class="file-icon ${file.type}">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-date">${formattedDate}</div>
      </div>
    `;

    // Add event listeners for folders/files
    fileEl.addEventListener("click", () => {
      if (file.type === "folder") navigateToFolder(file.id, file.name);
      else previewFile(file);
    });

    filesContainer.appendChild(fileEl);
  });
}

// Navigate to a folder
async function navigateToFolder(folderId, folderName) {
  currentFolderId = folderId;
  folderPath.push({ id: folderId, name: folderName });
  updateBreadcrumb();
  await loadFiles();
}

// Update breadcrumb navigation
function updateBreadcrumb() {
  currentPathEl.textContent = folderPath.map((f) => f.name).join(" > ");
}

// Preview a file
async function previewFile(file) {
  if (!file.path) {
    alert("File not available for preview.");
    return;
  }

  try {
    const { data, error } = await supabase.storage
      .from("drive-files")
      .createSignedUrl(file.path, 60); // 60 seconds expiry

    if (error) throw error;

    // Open the file in a new tab
    window.open(data.signedUrl, "_blank");
  } catch (error) {
    console.error("Error previewing file:", error);
    alert("Could not preview file. Please try again.");
  }
}

// Update storage info
async function updateStorageInfo() {
  try {
    const { data, error } = await supabase.from("files").select("size");

    if (error) throw error;

    storageUsed =
      data.reduce((total, f) => total + (f.size || 0), 0) /
      (1024 * 1024 * 1024); // Convert bytes to GB

    document.querySelector(".storage-used").style.width =
      Math.min((storageUsed / 15) * 100, 100) + "%"; // Assuming max is 15GB

    document.querySelector(
      ".storage-text"
    ).textContent = `${storageUsed.toFixed(2)} GB of 15 GB used`;
  } catch (error) {
    console.error(error);
  }
}
