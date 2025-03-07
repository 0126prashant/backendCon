const Contact = require("../models/Contact");

const contactController = {
  // Get all contacts with pagination and search
  getContacts: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const query = search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { phone: { $regex: search, $options: 'i' } }
            ]
          }
        : {};

      const contacts = await Contact.find(query)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Contact.countDocuments(query);

      res.json({
        contacts,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalContacts: total
      });
    } catch (error) {
      console.error('Error getting contacts:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get contact statistics
  getStats: async (req, res) => {
    try {
      const total = await Contact.countDocuments();
      const assigned = await Contact.countDocuments({ assignedTo: { $ne: null } });
      const unassigned = await Contact.countDocuments({ assignedTo: null });
      const contacted = await Contact.countDocuments({ status: 'contacted' });

      // Get contacts per user statistics
      const contactsPerUser = await Contact.aggregate([
        {
          $match: { assignedTo: { $ne: null } }
        },
        {
          $group: {
            _id: '$assignedTo',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        total,
        assigned,
        unassigned,
        contacted,
        contactsPerUser
      });
    } catch (error) {
      console.error('Error getting contact stats:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get assigned contacts for a user
  getAssignedContacts: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 20, search = '' } = req.query;
      
      const query = {
        assignedTo: userId,
        ...(search ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
          ]
        } : {})
      };

      const contacts = await Contact.find(query)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Contact.countDocuments(query);

      res.json({
        contacts,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalContacts: total
      });
    } catch (error) {
      console.error('Error getting assigned contacts:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update contact status
  updateStatus: async (req, res) => {
    try {
      const { status } = req.body;
      const contact = await Contact.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      ).populate('assignedTo', 'name email');
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error('Error updating contact status:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Create new contact
  createContact: async (req, res) => {
    try {
      const newContact = new Contact({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
      });
      const savedContact = await newContact.save();
      res.status(201).json(savedContact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Assign contacts to user
  assignContacts: async (req, res) => {
    try {
      const { contactIds, userId } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || !userId) {
        return res.status(400).json({ message: 'Invalid request data' });
      }

      const updatedContacts = await Contact.updateMany(
        { _id: { $in: contactIds } },
        { 
          $set: { 
            assignedTo: userId,
            status: 'assigned',
            assignmentDate: new Date()
          } 
        }
      );

      res.json({
        message: 'Contacts assigned successfully',
        modifiedCount: updatedContacts.modifiedCount
      });
    } catch (error) {
      console.error('Error assigning contacts:', error);
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = contactController;
