const SUPABASE_URL = "https://cspjbqypspcpojibljrl.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzcGpicXlwc3BjcG9qaWJsanJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzMjM0NjYsImV4cCI6MjA1ODg5OTQ2Nn0.QAEyQ_ToPbERKjinEfKl8kSvjH8WdStVsR-4TPN9WXA";

// ✅ Ensure Supabase is available before use
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const authModal = document.getElementById("auth-modal");
const authTitle = document.getElementById("auth-title");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const googleAuthBtn = document.getElementById("google-auth");
const toggleAuth = document.getElementById("toggle-auth");
const authStatus = document.getElementById("auth-status");
const closeModal = document.querySelector(".close");

// Show Login/Signup Modal
document.getElementById("show-login").addEventListener("click", () => {
  authTitle.textContent = "Sign In";
  authSubmit.textContent = "Login";
  authModal.style.display = "block";
});

document.getElementById("show-signup").addEventListener("click", () => {
  authTitle.textContent = "Sign Up";
  authSubmit.textContent = "Sign Up";
  authModal.style.display = "block";
});

closeModal.addEventListener("click", () => (authModal.style.display = "none"));

// Toggle Signup/Login Mode
toggleAuth.addEventListener("click", () => {
  if (authTitle.textContent === "Sign In") {
    authTitle.textContent = "Sign Up";
    authSubmit.textContent = "Sign Up";
    toggleAuth.textContent = "Already have an account? Sign In";
  } else {
    authTitle.textContent = "Sign In";
    authSubmit.textContent = "Login";
    toggleAuth.textContent = "Don't have an account? Sign Up";
  }
});

// Handle Signup & Login
authSubmit.addEventListener("click", async () => {
  const email = authEmail.value;
  const password = authPassword.value;

  let response;
  if (authSubmit.textContent === "Sign Up") {
    response = await supabase.auth.signUp({ email, password });
  } else {
    response = await supabase.auth.signInWithPassword({ email, password });
  }

  if (response.error) {
    alert(response.error.message);
  } else {
    alert("Success! Check your email for verification.");
    authStatus.textContent = `Logged in as ${response.data.user.email}`;
    authModal.style.display = "none";
    window.location.href = "home.html";
  }
});

// Handle Google Login
googleAuthBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
  if (error) {
    console.error("Google Auth Error:", error.message);
  }
});

// Check Authentication Status
async function checkAuth() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && window.location.pathname.includes("home.html")) {
    alert("You must be logged in to access this page.");
    window.location.href = "login.html";
  }
}
checkAuth();
