const DailySales = require('../models/DailySales');

const getSales = async (req, res) => {
  try {
    const { branch, from, to, page = 1, limit = 30 } = req.query;
    const q = { company: req.companyId };
    if (branch) q.branch = branch;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to)   q.date.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      DailySales.find(q)
        .populate('branch',      'name code')
        .populate('submittedBy', 'fullName')
        .sort({ date: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      DailySales.countDocuments(q)
    ]);

    // Totals for the filtered range
    const agg = await DailySales.aggregate([
      { $match: q },
      { $group: {
        _id: null,
        totalCash:     { $sum: '$cashSales' },
        totalPOS:      { $sum: '$posSales' },
        totalTransfer: { $sum: '$transferSales' },
        totalSales:    { $sum: '$totalSales' },
        totalExpenses: { $sum: '$expenses' },
        totalShortage: { $sum: '$shortageAmount' }
      }}
    ]);
    const totals = agg[0] || { totalCash: 0, totalPOS: 0, totalTransfer: 0, totalSales: 0, totalExpenses: 0, totalShortage: 0 };

    res.json({ success: true, sales: records, total, pages: Math.ceil(total / parseInt(limit)), totals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createSales = async (req, res) => {
  try {
    const { branchId, date, sessionLabel, cashSales, posSales, transferSales, expenses, expensesNote, shortageAmount, shortageNote, notes } = req.body;
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch is required' });
    if (!date)     return res.status(400).json({ success: false, message: 'Date is required' });

    const s = await DailySales.create({
      company: req.companyId, branch: branchId, submittedBy: req.user._id,
      date:    new Date(date), sessionLabel: sessionLabel || '',
      cashSales:     parseFloat(cashSales)     || 0,
      posSales:      parseFloat(posSales)      || 0,
      transferSales: parseFloat(transferSales) || 0,
      expenses:      parseFloat(expenses)      || 0,
      expensesNote:  expensesNote  || '',
      shortageAmount: parseFloat(shortageAmount) || 0,
      shortageNote:  shortageNote  || '',
      notes: notes || '', status: 'submitted'
    });
    await s.populate(['branch', 'submittedBy']);
    res.status(201).json({ success: true, sales: s });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateSales = async (req, res) => {
  try {
    const s = await DailySales.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: req.body }, { new: true, runValidators: true }
    );
    if (!s) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, sales: s });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteSales = async (req, res) => {
  try {
    await DailySales.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getSalesSummary = async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = month ? parseInt(month) : null;

    let dateFilter;
    if (m) {
      dateFilter = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0, 23, 59, 59) };
    } else {
      dateFilter = { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31, 23, 59, 59) };
    }

    const byBranch = await DailySales.aggregate([
      { $match: { company: req.companyId, date: dateFilter } },
      { $group: {
        _id: '$branch',
        totalSales:    { $sum: '$totalSales' },
        totalCash:     { $sum: '$cashSales' },
        totalPOS:      { $sum: '$posSales' },
        totalTransfer: { $sum: '$transferSales' },
        totalExpenses: { $sum: '$expenses' },
        totalShortage: { $sum: '$shortageAmount' },
        reportCount:   { $sum: 1 }
      }},
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $project: {
        branchName: { $ifNull: [{ $arrayElemAt: ['$branch.name', 0] }, 'Unknown'] },
        totalSales: 1, totalCash: 1, totalPOS: 1, totalTransfer: 1, totalExpenses: 1, totalShortage: 1, reportCount: 1
      }}
    ]);

    res.json({ success: true, byBranch });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getSales, createSales, updateSales, deleteSales, getSalesSummary };
