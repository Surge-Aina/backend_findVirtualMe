const Dashboard = require('../../models/dataScientist/dashboardModel');

// Get dashboard data
exports.getDashboard = async (req, res) => {
    try {
        const dashboard = await Dashboard.findOne({ isActive: true });
        if (!dashboard) {
            // Create default dashboard if none exists
            const defaultDashboard = new Dashboard();
            await defaultDashboard.save();
            res.status(200).json(defaultDashboard);
            return;
        }
        res.status(200).json(dashboard);
    } catch (error) {
        console.log('error getting dashboard: ', error);
        res.status(500).json({ message: 'error getting dashboard' });
    }
};

// Update dashboard data
exports.updateDashboard = async (req, res) => {
    const dashboardData = req.body;
    
    try {
        let dashboard = await Dashboard.findOne({ isActive: true });
        
        if (!dashboard) {
            dashboard = new Dashboard(dashboardData);
        } else {
            Object.assign(dashboard, dashboardData);
        }
        
        await dashboard.save();
        res.status(200).json(dashboard);
    } catch (error) {
        console.log('error updating dashboard: ', error);
        res.status(500).json({ message: 'error updating dashboard' });
    }
};

// Create new dashboard
exports.createDashboard = async (req, res) => {
    const dashboardData = req.body;
    
    try {
        const dashboard = new Dashboard(dashboardData);
        await dashboard.save();
        res.status(201).json(dashboard);
    } catch (error) {
        console.log('error creating dashboard: ', error);
        res.status(500).json({ message: 'error creating dashboard' });
    }
};

// Delete dashboard
exports.deleteDashboard = async (req, res) => {
    const id = req.params.id;
    
    try {
        const dashboard = await Dashboard.findByIdAndDelete(id);
        
        if (!dashboard) {
            return res.status(404).json({ message: 'Dashboard not found' });
        }

        res.status(200).json({ message: 'Dashboard deleted successfully' });
    } catch (error) {
        console.log('error deleting dashboard: ', error);
        res.status(500).json({ message: 'error deleting dashboard' });
    }
};
