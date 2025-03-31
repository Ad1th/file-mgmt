// Add this route to your existing index.js file

// Route for renaming files and folders
app.get('/rename/:id', authenticate, async (req, res) => {
    const itemId = req.params.id;
  
    try {
      // Fetch the file or folder details
      const { data: item, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', req.user.id)
        .single();
  
      if (error || !item) {
        console.error('Error fetching item:', error);
        return res.status(404).json({ error: 'Item not found' });
      }
  
      res.render('rename', { item });
    } catch (error) {
      console.error('Error loading rename page:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/rename/:id', authenticate, async (req, res) => {
    const itemId = req.params.id;
    const { newName } = req.body;
  
    if (!newName || newName.trim() === '') {
      return res.status(400).json({ error: 'New name is required' });
    }
  
    try {
      // Fetch the current item to get its details
      const { data: item, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', req.user.id)
        .single();
  
      if (fetchError || !item) {
        console.error('Error fetching item:', fetchError);
        return res.status(404).json({ error: 'Item not found' });
      }
  
      // Update the item name in the database
      const { error: updateError } = await supabase
        .from('files')
        .update({ name: newName.trim() })
        .eq('id', itemId)
        .eq('user_id', req.user.id);
  
      if (updateError) {
        console.error('Error updating item name:', updateError);
        return res.status(500).json({ error: 'Failed to rename item' });
      }
  
      // If it's a file (not a folder), update the file path in storage if needed
      if (item.type !== 'folder' && item.path) {
        // This would depend on your storage structure
        // You might need to update the file path in storage as well
      }
  
      // Redirect back to the appropriate page
      if (item.parent_id) {
        res.redirect(`/folder/${item.parent_id}`);
      } else {
        res.redirect('/dashboard');
      }
    } catch (error) {
      console.error('Error renaming item:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Add a route for sharing files
  app.post('/share/:id', authenticate, async (req, res) => {
    const fileId = req.params.id;
    const { email } = req.body;
  
    if (!email || email.trim() === '') {
      return res.status(400).json({ error: 'Email is required' });
    }
  
    try {
      // Fetch the file details
      const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', req.user.id)
        .single();
  
      if (fetchError || !file) {
        console.error('Error fetching file:', fetchError);
        return res.status(404).json({ error: 'File not found' });
      }
  
      // Create a share record in the database
      const { data, error } = await supabase
        .from('shares')
        .insert({
          file_id: fileId,
          user_id: req.user.id,
          shared_with: email.trim(),
          created_at: new Date().toISOString()
        });
  
      if (error) {
        console.error('Error sharing file:', error);
        return res.status(500).json({ error: 'Failed to share file' });
      }
  
      res.status(200).json({ message: 'File shared successfully' });
    } catch (error) {
      console.error('Error sharing file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Enhance the logout route to clear cookies
  app.post('/logout', (req, res) => {
    try {
      // Clear the token cookie
      res.clearCookie('token');
      
      // Redirect to home page
      res.redirect('/');
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });