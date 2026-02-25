const express = require('express');
const router = express.Router();
const Testimonial = require('../../models/dataScientist/testimonialModel');


// Get all approved testimonials (public route)
router.get('/', async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get top 3 recent approved testimonials (public route)
router.get('/top', async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(3);
    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit a new testimonial (public route)
router.post('/', async (req, res) => {
  try {
    const { name, email, rating, review } = req.body;

    // Validation
    if (!name || !email || !rating || !review) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (review.length > 1000) {
      return res.status(400).json({ message: 'Review must be less than 1000 characters' });
    }

    const testimonial = new Testimonial({
      name,
      email,
      rating,
      review
    });

    await testimonial.save();
    res.status(201).json({ message: 'Testimonial submitted successfully! It will be reviewed before being published.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all testimonials (admin only)
router.get('/admin', async (req, res) => {
  try {
    const testimonials = await Testimonial.find()
      .sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/Reject testimonial (admin only)
router.patch('/admin/:id', async (req, res) => {
  try {
    const { isApproved } = req.body;
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      { new: true }
    );

    if (!testimonial) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    res.json(testimonial);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete testimonial (admin only)
router.delete('/admin/:id', async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    
    if (!testimonial) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    res.json({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
