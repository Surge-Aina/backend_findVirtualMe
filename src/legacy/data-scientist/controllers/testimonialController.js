const Testimonial = require('../models/testimonialModel');

// Get all approved testimonials (public)
exports.getApprovedTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find({ isApproved: true })
            .sort({ createdAt: -1 })
            .limit(10);
        res.status(200).json(testimonials);
    } catch (error) {
        console.log('error getting testimonials: ', error);
        res.status(500).json({ message: 'error getting testimonials' });
    }
};

// Get top 3 recent approved testimonials (public)
exports.getTopTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find({ isApproved: true })
            .sort({ createdAt: -1 })
            .limit(3);
        res.status(200).json(testimonials);
    } catch (error) {
        console.log('error getting top testimonials: ', error);
        res.status(500).json({ message: 'error getting top testimonials' });
    }
};

// Submit a new testimonial (public)
exports.submitTestimonial = async (req, res) => {
    const { name, email, rating, review } = req.body;
    
    try {
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
        console.log('error submitting testimonial: ', error);
        res.status(500).json({ message: 'error submitting testimonial' });
    }
};

// Get all testimonials (admin only)
exports.getAllTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find()
            .sort({ createdAt: -1 });
        res.status(200).json(testimonials);
    } catch (error) {
        console.log('error getting all testimonials: ', error);
        res.status(500).json({ message: 'error getting all testimonials' });
    }
};

// Approve/Reject testimonial (admin only)
exports.updateTestimonialApproval = async (req, res) => {
    const { isApproved } = req.body;
    const id = req.params.id;
    
    try {
        const testimonial = await Testimonial.findByIdAndUpdate(
            id,
            { isApproved },
            { new: true }
        );

        if (!testimonial) {
            return res.status(404).json({ message: 'Testimonial not found' });
        }

        res.status(200).json(testimonial);
    } catch (error) {
        console.log('error updating testimonial approval: ', error);
        res.status(500).json({ message: 'error updating testimonial approval' });
    }
};

// Delete testimonial (admin only)
exports.deleteTestimonial = async (req, res) => {
    const id = req.params.id;
    
    try {
        const testimonial = await Testimonial.findByIdAndDelete(id);
        
        if (!testimonial) {
            return res.status(404).json({ message: 'Testimonial not found' });
        }

        res.status(200).json({ message: 'Testimonial deleted successfully' });
    } catch (error) {
        console.log('error deleting testimonial: ', error);
        res.status(500).json({ message: 'error deleting testimonial' });
    }
};
