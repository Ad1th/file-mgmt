const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const methodOverride = require("method-override");

require("dotenv").config();

const app = express();
const port = 3000;

// Supabase configuration
const SUPABASE_URL = "https://cspjbqypspcpojibljrl.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzcGpicXlwc3BjcG9qaWJsanJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzMjM0NjYsImV4cCI6MjA1ODg5OTQ2Nn0.QAEyQ_ToPbERKjinEfKl8kSvjH8WdStVsR-4TPN9WXA";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(cookieParser());
app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs");

// Middleware to verify authentication
const authenticate = async (req, res, next) => {
  const token = req.cookies.token; //Extract token from Authorization header

  if (!token) {
    return res.status(401).json({ error: "Authorization token is required" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error("Authentication error:", error);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = data.user; // Attach user info to request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Error during authentication:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Route for user signup
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("Error during signup:", error);
      return res.status(400).json({ error: error.message });
    }

    res.redirect("/signin");
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route for user signin
// Route to render the signin page
app.get("/signin", (req, res) => {
  res.render("signin");
});

// Route to render the signup page
app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Error during signin:", error);
      return res.status(400).json({ error: error.message });
    }
    res.cookie("token", data.session.access_token);
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error during signin:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route for file deletion
app.delete("/file/:id", authenticate, async (req, res) => {
  const fileId = req.params.id;

  // Retrieve file record from database
  const { data: fileData, error: fileSelectError } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .eq("user_id", req.user.id)
    .single();

  if (fileSelectError || !fileData) {
    console.error("Error finding file:", fileSelectError);
    return res.status(404).json({ error: "File not found" });
  }

  // Delete the file from storage if it is not a folder
  if (fileData.type !== "folder") {
    const { error: storageDeleteError } = await supabase.storage
      .from("drive-files")
      .remove([fileData.path]);
    if (storageDeleteError) {
      console.error("Error deleting file from storage:", storageDeleteError);
      return res
        .status(500)
        .json({ error: "Failed to delete file from storage" });
    }
  }

  // Delete the file record from database
  const { error: dbDeleteError } = await supabase
    .from("files")
    .delete()
    .eq("id", fileId);

  if (dbDeleteError) {
    console.error("Error deleting file record:", dbDeleteError);
    return res.status(500).json({ error: "Failed to delete file record" });
  }

  res.redirect("dashboard");
});
app.post("/logout", authenticate, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error during logout:", error);
      return res.status(400).json({ error: error.message });
    }

    res.redirect("/");
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route for home page
app.get("/", (req, res) => {
  res.render("home");
});

// Route for file upload
app.post("/upload", authenticate, async (req, res) => {
  const file = req.files?.file;
  console.log(req.files);

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const filePath = `${req.user.id}/${Date.now()}_${file.name}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from("drive-files")
      .upload(filePath, file.data, {
        contentType: file.mimetype,
      });

    if (storageError) throw storageError;

    // Determine file type
    let type = "other";
    if (file.name.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i)) type = "image";
    else if (file.name.match(/\.(doc|docx|pdf|txt|rtf)$/i)) type = "document";
    else if (file.name.match(/\.(xls|xlsx|csv)$/i)) type = "spreadsheet";
    else if (file.name.match(/\.(js|py|java|html|css|c|cpp|php)$/i))
      type = "code";

    // Add file record to database
    const { data, error } = await supabase.from("files").insert({
      user_id: req.user.id,
      name: file.name,
      type,
      size: file.size,
      path: filePath,
    });

    if (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json({ error: "Failed to upload file" });
    }

    const { publicUrl } = supabase.storage
      .from("uploads")
      .getPublicUrl(`${req.user.id}/${file.name}`);

    await supabase
      .from("files")
      .insert([{ user_id: req.user.id, name: file.name, url: publicUrl }]);

    res.send("File uploaded");
  } catch (error) {
    console.error("Error during file upload:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route for creating a folder
app.post("/create-folder", authenticate, async (req, res) => {
  const { folderName, parentId } = req.body;

  if (!folderName || folderName.trim() === "") {
    return res.status(400).json({ error: "Folder name is required" });
  }

  try {
    const { data, error } = await supabase
      .from("files")
      .insert({
        name: folderName.trim(),
        type: "folder",
        parent_id: parentId || null,
        size: 0,
        user_id: req.user.id,
      })
      .select();

    if (error) throw error;

    res.send("Folder created");
  } catch (error) {
    console.error("Error creating folder:", error);
    res
      .status(500)
      .json({ error: "Failed to create folder. Please try again." });
  }
});

// Route for dashboard page
app.get("/dashboard", authenticate, async (req, res) => {
  try {
    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", req.user.id)
      .neq("type", "folder");

    const { data: folders, error: foldersError } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("type", "folder");

    if (filesError || foldersError) {
      console.error(
        "Error fetching files or folders:",
        filesError || foldersError
      );
      return res
        .status(500)
        .json({ error: "Failed to fetch files or folders" });
    }
    console.log(10);
    console.log("folders");
    res.render("dashboard", { user: req.user, files, folders });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to view a folder and upload files to it
app.get("/folder/:id", authenticate, async (req, res) => {
  const folderId = req.params.id;

  try {
    // Fetch folder details
    const { data: folder, error: folderError } = await supabase
      .from("files")
      .select("*")
      .eq("id", folderId)
      .single();

    if (folderError || !folder) {
      console.error("Error fetching folder:", folderError);
      return res.status(404).json({ error: "Folder not found" });
    }

    // Fetch files and subfolders in the folder
    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("*")
      .eq("parent_id", folderId)
      .neq("type", "folder");

    const { data: subfolders, error: subfoldersError } = await supabase
      .from("files")
      .select("*")
      .eq("parent_id", folderId)
      .eq("type", "folder");

    if (filesError || subfoldersError) {
      console.error(
        "Error fetching files or subfolders:",
        filesError || subfoldersError
      );
      return res
        .status(500)
        .json({ error: "Failed to fetch files or subfolders" });
    }

    res.render("folder", { folder, files, subfolders });
  } catch (error) {
    console.error("Error viewing folder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/folder/:id/upload", authenticate, async (req, res) => {
  const folderId = req.params.id;
  const file = req.files?.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const filePath = `${req.user.id}/${folderId}/${Date.now()}_${file.name}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from("drive-files")
      .upload(filePath, file.data, {
        contentType: file.mimetype,
      });

    if (storageError) throw storageError;

    // Determine file type
    let type = "other";
    if (file.name.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i)) type = "image";
    else if (file.name.match(/\.(doc|docx|pdf|txt|rtf)$/i)) type = "document";
    else if (file.name.match(/\.(xls|xlsx|csv)$/i)) type = "spreadsheet";
    else if (file.name.match(/\.(js|py|java|html|css|c|cpp|php)$/i))
      type = "code";

    // Add file record to database
    const { data, error } = await supabase.from("files").insert({
      user_id: req.user.id,
      name: file.name,
      type,
      size: file.size,
      path: filePath,
      parent_id: folderId,
    });

    if (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json({ error: "Failed to upload file" });
    }

    res.send("uploaded");
  } catch (error) {
    console.error("Error during file upload:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/file/:id/rename", authenticate, async (req, res) => {
  const fileId = req.params.id;
  const { newName } = req.body;

  if (!newName || newName.trim() === "") {
    return res.status(400).json({ error: "New name is required" });
  }

  try {
    // Check if the file exists and belongs to the user
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .eq("user_id", req.user.id)
      .single();

    if (fileError || !file) {
      console.error("Error finding file:", fileError);
      return res.status(404).json({ error: "File not found" });
    }

    // Update the file name in the database
    const { error: updateError } = await supabase
      .from("files")
      .update({ name: newName.trim() })
      .eq("id", fileId);

    if (updateError) {
      console.error("Error renaming file:", updateError);
      return res.status(500).json({ error: "Failed to rename file" });
    }

    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error during file renaming:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to download a file
app.get("/file/:id/download", authenticate, async (req, res) => {
  const fileId = req.params.id;

  try {
    // Retrieve file record from database
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .eq("user_id", req.user.id)
      .single();

    if (fileError || !file) {
      console.error("Error finding file:", fileError);
      return res.status(404).json({ error: "File not found" });
    }

    // Generate a signed URL for the file
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage.from("drive-files").createSignedUrl(file.path, 60); // URL valid for 60 seconds

    if (signedUrlError) {
      console.error("Error generating signed URL:", signedUrlError);
      return res.status(500).json({ error: "Failed to generate download URL" });
    }

    res.redirect(signedUrlData.signedUrl);
  } catch (error) {
    console.error("Error during file download:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000);
