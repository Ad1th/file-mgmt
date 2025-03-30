const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');

require('dotenv').config();

const app = express();
const port = 3000;



// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(cookieParser());
app.use(express.urlencoded({extended: true}));
app.use(fileUpload());
app.use(express.urlencoded({extended: true}));
app.set('views', './views');
app.set('view engine', 'ejs');

// Middleware to verify authentication
const authenticate = async (req, res, next) => {
    const token = req.cookies.token; //Extract token from Authorization header

    if (!token) {
        return res.status(401).json({ error: 'Authorization token is required' });
    }

    try {
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            console.error('Authentication error:', error);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = data.user; // Attach user info to request object
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Route for user signup
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            console.error('Error during signup:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(200).json({ message: 'Signup successful', data });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route for user signin
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body);

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Error during signin:', error);
            return res.status(400).json({ error: error.message });
        }
        //res.redirect('/dashboard');
        res.cookie('token', data.session.access_token)
        res.status(200).json({ message: 'Signin successful'});
    } catch (error) {
        console.error('Error during signin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route for user logout
app.post('/logout', authenticate, async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Error during logout:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route for home page
app.get('/', (req, res) => {
    res.render('home');
});


// Route for file upload
app.post('/upload', authenticate, async (req, res) => {
    const file = req.files?.file;
    console.log(req.files);

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const filePath = `${req.user.id}/${Date.now()}_${file.name}`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('drive-files')
            .upload(filePath, file.data, {
            contentType: file.mimetype,
            });

        if (storageError) throw storageError;

        // Determine file type
        let type = 'other';
        if (file.name.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i)) type = 'image';
        else if (file.name.match(/\.(doc|docx|pdf|txt|rtf)$/i)) type = 'document';
        else if (file.name.match(/\.(xls|xlsx|csv)$/i)) type = 'spreadsheet';
        else if (file.name.match(/\.(js|py|java|html|css|c|cpp|php)$/i)) type = 'code';

        // Add file record to database
        const { data, error } = await supabase
            .from('files')
            .insert({
            user_id: req.user.id,
            name: file.name,
            type,
            size: file.size,
            path: filePath,
            });

        if (error) {
            console.error('Error uploading file:', error);
            return res.status(500).json({ error: 'Failed to upload file' });
        }

        const { publicUrl } = supabase.storage
            .from('uploads')
            .getPublicUrl(`${req.user.id}/${file.name}`);

        await supabase.from('files').insert([
            { user_id: req.user.id, name: file.name, url: publicUrl },
        ]);

        res.status(200).json({ message: 'File uploaded successfully', url: publicUrl });
    } catch (error) {
        console.error('Error during file upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route for creating a folder
app.post('/create-folder', authenticate, async (req, res) => {
    const { folderName, parentId } = req.body;

    if (!folderName || folderName.trim() === "") {
        return res.status(400).json({ error: 'Folder name is required' });
    }

    try {
        const { data, error } = await supabase
            .from('files')
            .insert({
                name: folderName.trim(),
                type: 'folder',
                parent_id: parentId || null,
                size: 0,
                user_id: req.user.id,
            })
            .select();

        if (error) throw error;

        res.status(200).json({ message: 'Folder created successfully', data });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder. Please try again.' });
    }
});

// Route for dashboard page
app.get('/dashboard', authenticate, async (req, res) => {
    try {
        const { data: files, error: filesError } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', req.user.id)
            .neq('type', 'folder');

        const { data: folders, error: foldersError } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('type', 'folder');

        if (filesError || foldersError) {
            console.error('Error fetching files or folders:', filesError || foldersError);
            return res.status(500).json({ error: 'Failed to fetch files or folders' });
        }
        console.log(10);
        console.log('folders');
        res.render('dashboard', { user: req.user, files, folders });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to view a folder and upload files to it
app.get('/folder/:id', authenticate, async (req, res) => {
    const folderId = req.params.id;

    try {
        // Fetch folder details
        const { data: folder, error: folderError } = await supabase
            .from('files')
            .select('*')
            .eq('id', folderId)
            .single();

        if (folderError || !folder) {
            console.error('Error fetching folder:', folderError);
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Fetch files and subfolders in the folder
        const { data: files, error: filesError } = await supabase
            .from('files')
            .select('*')
            .eq('parent_id', folderId)
            .neq('type', 'folder');

        const { data: subfolders, error: subfoldersError } = await supabase
            .from('files')
            .select('*')
            .eq('parent_id', folderId)
            .eq('type', 'folder');

        if (filesError || subfoldersError) {
            console.error('Error fetching files or subfolders:', filesError || subfoldersError);
            return res.status(500).json({ error: 'Failed to fetch files or subfolders' });
        }

        res.render('folder', { folder, files, subfolders });
    } catch (error) {
        console.error('Error viewing folder:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/folder/:id/upload', authenticate, async (req, res) => {
    const folderId = req.params.id;
    const file = req.files?.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const filePath = `${req.user.id}/${folderId}/${Date.now()}_${file.name}`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('drive-files')
            .upload(filePath, file.data, {
                contentType: file.mimetype,
            });

        if (storageError) throw storageError;

        // Determine file type
        let type = 'other';
        if (file.name.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i)) type = 'image';
        else if (file.name.match(/\.(doc|docx|pdf|txt|rtf)$/i)) type = 'document';
        else if (file.name.match(/\.(xls|xlsx|csv)$/i)) type = 'spreadsheet';
        else if (file.name.match(/\.(js|py|java|html|css|c|cpp|php)$/i)) type = 'code';

        // Add file record to database
        const { data, error } = await supabase
            .from('files')
            .insert({
                user_id: req.user.id,
                name: file.name,
                type,
                size: file.size,
                path: filePath,
                parent_id: folderId,
            });

        if (error) {
            console.error('Error uploading file:', error);
            return res.status(500).json({ error: 'Failed to upload file' });
        }

        res.status(200).json({ message: 'File uploaded successfully' });
    } catch (error) {
        console.error('Error during file upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(3000);