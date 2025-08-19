const { supabase, supabaseAdmin } = require('../config/supabase')
const emailService = require('../utils/emailService')
const { generateSalarySlipPDF } = require('../utils/salarySlipPDF')
const { 
  calculateWorkingDaysInMonth, 
  calculateDailySalary, 
  calculateWorkingDaysBetween,
  calculateLeaveDays
} = require('../utils/workingDaysCalculator')

// Get salary components
const getSalaryComponents = async (req, res) => {
  try {
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: components, error } = await supabaseAdmin
      .from('salary_components')
      .select('*')
      .eq('company_id', currentUser.company_id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ components });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add new salary component
const addSalaryComponent = async (req, res) => {
  try {
    const { name, description, component_type } = req.body;
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields
    if (!name || !component_type) {
      return res.status(400).json({ error: 'Name and component type are required' });
    }

    if (!['addition', 'deduction'].includes(component_type)) {
      return res.status(400).json({ error: 'Component type must be addition or deduction' });
    }

    const { data: component, error } = await supabaseAdmin
      .from('salary_components')
      .insert([{
        name,
        description,
        component_type,
        created_by: currentUser.id,
        company_id: currentUser.company_id,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Salary component added successfully',
      component
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get employee fixed deductions
const getEmployeeFixedDeductions = async (employeeId) => {
  try {
    const { data: deductions, error } = await supabaseAdmin
      .from('employee_fixed_deductions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('deduction_name', { ascending: true });

    if (error) {
      // If table doesn't exist, return empty array instead of throwing error
      if (error.code === '42P01') { // Table doesn't exist
        return [];
      }
      throw new Error(error.message);
    }

    return deductions || [];
  } catch (error) {
    return [];
  }
};

// Calculate leave impact on salary
const calculateLeaveImpact = async (employeeId, month, year) => {
  try {
    // Get employee's annual salary and company_id
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('salary, company_id')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      throw new Error('Employee not found');
    }

    // Get leave requests for the specific month and year
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get unpaid leave requests for the month
    // First, get all leave types to identify which ones are unpaid
    const { data: leaveTypes, error: typesError } = await supabaseAdmin
      .from('leave_types')
      .select('id, name, is_paid')
      .eq('is_paid', false); // Get all unpaid leave types
    
    let unpaidLeaveTypeIds = ['550e8400-e29b-41d4-a716-446655440003']; // Personal Leave fallback
    
    if (typesError) {
      console.warn('⚠️ Could not fetch leave types, using fallback logic');
      // Fallback: use hardcoded unpaid leave type IDs
    } else {
      // Get IDs of all unpaid leave types
      unpaidLeaveTypeIds = leaveTypes.map(lt => lt.id);
      console.log('🔍 Unpaid leave types found:', leaveTypes.map(lt => ({ name: lt.name, id: lt.id })));
      
      if (unpaidLeaveTypeIds.length === 0) {
        console.log('⚠️ No unpaid leave types found, using fallback');
        unpaidLeaveTypeIds = ['550e8400-e29b-41d4-a716-446655440003']; // Personal Leave fallback
      }
    }
    
    // Get unpaid leave requests for the month
    const { data: unpaidLeaves, error: leaveError } = await supabaseAdmin
      .from('leave_requests')
      .select(`
        total_days, 
        leave_type_id,
        leave_types (
          id,
          name,
          is_paid
        )
      `)
      .eq('employee_id', employeeId)
      .eq('status', 'approved_by_hr')
      .gte('start_date', startDate.toISOString().split('T')[0])
      .lte('end_date', endDate.toISOString().split('T')[0])
      .in('leave_type_id', unpaidLeaveTypeIds);

    if (leaveError) {
      // If table doesn't exist, continue with no leaves
      if (leaveError.code === '42P01') {
        return 0;
      }
      throw new Error(leaveError.message);
    }

    // Calculate total unpaid days
    const totalUnpaidDays = unpaidLeaves?.reduce((sum, leave) => sum + (leave.total_days || 0), 0) || 0;
    
    // Log detailed unpaid leave information
    console.log('🔍 Unpaid leave calculation details:', {
      employeeId,
      month,
      year,
      unpaidLeaves: unpaidLeaves || [],
      totalUnpaidDays,
      employeeSalary: employee.salary,
      dailySalaryRate: employee.salary / 12 / 30
    });

    // Calculate daily salary rate based on 30 days (not working days)
    // This ensures consistent salary calculation regardless of working days
    const dailySalaryRate = employee.salary / 12 / 30; // Monthly salary ÷ 30 days

    // Calculate leave impact
    const leaveImpact = totalUnpaidDays * dailySalaryRate;
    
    console.log('💰 Leave impact calculation:', {
      totalUnpaidDays,
      dailySalaryRate,
      leaveImpact,
      message: `Deducting ₹${leaveImpact.toFixed(2)} for ${totalUnpaidDays} unpaid leave days`
    });

    // Store leave impact for future reference (optional)
    try {
      await supabaseAdmin
        .from('leave_salary_impact')
        .upsert([{
          employee_id: employeeId,
          month,
          year,
          unpaid_days: totalUnpaidDays,
          impact_amount: leaveImpact,
          created_at: new Date().toISOString()
        }]);
    } catch (impactError) {
      // If table doesn't exist, continue without storing
      if (impactError.code !== '42P01') {
        // Only log if it's not a table doesn't exist error
      }
    }

    return leaveImpact;
  } catch (error) {
    console.error('❌ calculateLeaveImpact error:', error);
    return 0;
  }
};

// Regenerate salary slip for a specific month (useful when unpaid leave is approved after salary generation)
const regenerateSalarySlip = async (req, res) => {
  try {
    const { employee_id, month, year } = req.body
    const currentUser = req.user

    console.log('🔄 regenerateSalarySlip called with:', {
      employee_id,
      month,
      year,
      user: { id: currentUser.id, role: currentUser.role, company_id: currentUser.company_id }
    })

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Validate required fields
    if (!employee_id || !month || !year) {
      return res.status(400).json({ error: 'Employee ID, month, and year are required' })
    }

    // Ensure month and year are numbers
    const monthNum = parseInt(month)
    const yearNum = parseInt(year)

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' })
    }

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ error: 'Year must be between 2020 and 2030' })
    }

    // Check if salary slip exists for this month
    const { data: existingSlip, error: checkError } = await supabaseAdmin
      .from('salary_slips')
      .select('id, net_salary, gross_salary')
      .eq('employee_id', employee_id)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .single()

    if (!existingSlip) {
      return res.status(404).json({ error: 'Salary slip not found for this month' })
    }

    console.log('🔄 Regenerating salary slip for existing slip:', existingSlip.id)

    // Delete the existing salary slip and details
    const { error: deleteDetailsError } = await supabaseAdmin
      .from('salary_slip_details')
      .delete()
      .eq('salary_slip_id', existingSlip.id)

    if (deleteDetailsError) {
      console.error('❌ Error deleting salary slip details:', deleteDetailsError)
      return res.status(500).json({ error: 'Failed to delete existing salary slip details' })
    }

    const { error: deleteSlipError } = await supabaseAdmin
      .from('salary_slips')
      .delete()
      .eq('id', existingSlip.id)

    if (deleteSlipError) {
      console.error('❌ Error deleting salary slip:', deleteSlipError)
      return res.status(500).json({ error: 'Failed to delete existing salary slip' })
    }

    console.log('✅ Existing salary slip deleted, regenerating with updated leave information...')

    // Now call the original generateSalarySlip function
    // We'll reuse the existing logic by calling it recursively
    const regenerateReq = {
      body: { employee_id, month: monthNum, year: yearNum, additions: [], deductions: [], notes: 'Regenerated due to unpaid leave approval' },
      user: currentUser
    }

    // Call the generateSalarySlip function
    const result = await generateSalarySlip(regenerateReq, res)
    
    if (result) {
      console.log('✅ Salary slip regenerated successfully with updated unpaid leave deductions')
    }

  } catch (error) {
    console.error('❌ Regenerate salary slip error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Get unpaid leave days for a specific month (for salary calculation)
const getUnpaidLeaveDaysForMonth = async (employeeId, month, year) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get unpaid leave requests for the month
    // First, get all leave types to identify which ones are unpaid
    const { data: leaveTypes, error: typesError } = await supabaseAdmin
      .from('leave_types')
      .select('id, name, is_paid')
      .eq('is_paid', false); // Get all unpaid leave types
    
    let unpaidLeaveTypeIds = ['550e8400-e29b-41d4-a716-446655440003']; // Personal Leave fallback
    
    if (!typesError && leaveTypes && leaveTypes.length > 0) {
      // Get IDs of all unpaid leave types
      unpaidLeaveTypeIds = leaveTypes.map(lt => lt.id);
      console.log('🔍 Unpaid leave types for month calculation:', leaveTypes.map(lt => ({ name: lt.name, id: lt.id })));
    }
    
    // Get unpaid leave requests for the month
    const { data: unpaidLeaves, error } = await supabaseAdmin
      .from('leave_requests')
      .select('total_days')
      .eq('employee_id', employeeId)
      .eq('status', 'approved_by_hr')
      .gte('start_date', startDate.toISOString().split('T')[0])
      .lte('end_date', endDate.toISOString().split('T')[0])
      .in('leave_type_id', unpaidLeaveTypeIds);

    if (error) {
      console.error('❌ Error fetching unpaid leave days:', error);
      return 0;
    }

    const totalUnpaidDays = unpaidLeaves?.reduce((sum, leave) => sum + (leave.total_days || 0), 0) || 0;
    console.log('🔍 Unpaid leave days for month:', { month, year, totalUnpaidDays });
    
    return totalUnpaidDays;
  } catch (error) {
    console.error('❌ getUnpaidLeaveDaysForMonth error:', error);
    return 0;
  }
};

// Generate salary slip
const generateSalarySlip = async (req, res) => {
  try {
    console.log('🔍 generateSalarySlip called with:', {
      body: req.body,
      user: { id: req.user.id, role: req.user.role, company_id: req.user.company_id }
    });

    const { 
      employee_id, 
      month, 
      year, 
      additions = [], 
      deductions = [],
      notes = ''
    } = req.body;
    
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields
    if (!employee_id || !month || !year) {
      return res.status(400).json({ error: 'Employee ID, month, and year are required' });
    }

    // Ensure month and year are numbers
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ error: 'Year must be between 2020 and 2030' });
    }

    // Check if salary slip already exists for this month
    const { data: existingSlip, error: checkError } = await supabaseAdmin
      .from('salary_slips')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('month', monthNum)
      .eq('year', yearNum)
      .single();

    if (existingSlip) {
      return res.status(400).json({ error: 'Salary slip already exists for this month' });
    }

    // Get employee details with company isolation
    let employeeQuery = supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', employee_id);

    // Apply company isolation for ALL users (including admin)
    employeeQuery = employeeQuery.eq('company_id', currentUser.company_id);

    const { data: employee, error: empError } = await employeeQuery.single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found or access denied' });
    }

    // Parallel execution of heavy operations to reduce total time
    const [leaveImpact, fixedDeductions, totalWorkingDaysInMonth] = await Promise.all([
      calculateLeaveImpact(employee_id, monthNum, yearNum),
      getEmployeeFixedDeductions(employee_id),
      calculateWorkingDaysInMonth(employee.company_id, monthNum, yearNum)
    ]);

    // Get unpaid leave days specifically for salary calculation
    const unpaidLeaveDays = await getUnpaidLeaveDaysForMonth(employee_id, monthNum, yearNum);

    const totalFixedDeductions = fixedDeductions.reduce((sum, deduction) => {
      if (deduction.deduction_type === 'percentage') {
        return sum + (employee.salary * deduction.percentage / 100);
      } else {
        return sum + deduction.amount;
      }
    }, 0);

    const actualWorkingDays = totalWorkingDaysInMonth - unpaidLeaveDays;

    console.log('🔍 Salary calculation debug:', {
      leaveImpact,
      unpaidLeaveDays,
      totalWorkingDaysInMonth,
      actualWorkingDays,
      employeeSalary: employee.salary,
      monthlySalary: employee.salary / 12,
      dailySalaryRate: (employee.salary / 12) / 30
    });
    
    // Calculate salary based on 30 days per month (not working days)
    const monthlySalary = employee.salary / 12; // ₹30,000 for ₹360,000 annual salary
    const grossSalary = monthlySalary; // Gross salary is the monthly salary
    
    // Calculate daily salary rate for deductions (30 days basis)
    const dailySalaryRate = monthlySalary / 30;
    
    // Process additions and deductions with proper validation
    const processedAdditions = (Array.isArray(additions) ? additions : []).filter(item => 
      item && item.component_name && item.amount && parseFloat(item.amount) > 0
    ).map(item => ({
      component_id: item.component_id || null,
      component_name: item.component_name,
      component_type: 'addition',
      amount: parseFloat(item.amount),
      description: item.description || `Addition: ${item.component_name}`
    }));

    const processedDeductions = (Array.isArray(deductions) ? deductions : []).filter(item => 
      item && item.component_name && item.amount && parseFloat(item.amount) > 0
    ).map(item => ({
      component_id: item.component_id || null,
      component_name: item.component_name,
      component_type: 'deduction',
      amount: parseFloat(item.amount),
      description: item.description || `Deduction: ${item.component_name}`
    }));

    // Calculate totals
    const totalAdditions = processedAdditions.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = processedDeductions.reduce((sum, item) => sum + item.amount, 0) + 
                           totalFixedDeductions;

    // Calculate net salary: Gross + Additions - Deductions - Leave Impact
    const netSalary = grossSalary + totalAdditions - totalDeductions - leaveImpact;

    // Create salary slip with company_id
    const { data: salarySlip, error: slipError } = await supabaseAdmin
      .from('salary_slips')
      .insert([{
        employee_id,
        month: monthNum,
        year: yearNum,
        basic_salary: monthlySalary, // Store monthly basic salary
        total_working_days: totalWorkingDaysInMonth,
        actual_working_days: actualWorkingDays,
        unpaid_leaves: unpaidLeaveDays, // Total unpaid leave days for the month
        gross_salary: grossSalary,
        total_additions: totalAdditions,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        generated_by: currentUser.id,
        company_id: employee.company_id,
        notes: notes || ''
      }])
      .select()
      .single();

    if (slipError) {
      return res.status(500).json({ error: slipError.message });
    }

    // Create salary slip details for all components
    const allComponents = [
      ...processedAdditions,
      ...processedDeductions,
      ...fixedDeductions.map(deduction => ({
        component_id: null,
        component_name: deduction.deduction_name,
        component_type: 'deduction',
        amount: deduction.deduction_type === 'percentage' ? (employee.salary * deduction.percentage / 100) : deduction.amount,
        description: deduction.description || `Fixed ${deduction.deduction_name}`
      }))
    ];

    if (allComponents.length > 0) {
      const slipDetails = allComponents.map(item => ({
        salary_slip_id: salarySlip.id,
        component_id: item.component_id,
        component_name: item.component_name,
        component_type: item.component_type,
        amount: item.amount,
        description: item.description
      }));

      const { error: detailsError } = await supabaseAdmin
        .from('salary_slip_details')
        .insert(slipDetails);

      if (detailsError) {
        // Don't fail the entire operation if details fail
      }
    }

    // Send email notification to employee with PDF attachment (non-blocking)
    // Get slip details first, then send email in background
    console.log('🔍 Sending email with components:', allComponents.length, 'components');
    emailService.sendSalarySlipNotification(salarySlip, employee, allComponents)
      .then(() => console.log('✅ Salary slip email sent successfully'))
      .catch(emailError => {
        console.error('❌ Email failed but salary slip created:', emailError);
        console.error('❌ Email error details:', {
          message: emailError.message,
          stack: emailError.stack
        });
      });

    res.status(201).json({
      message: 'Salary slip generated successfully',
      salarySlip: {
        ...salarySlip,
        leaveImpact,
        components: allComponents
      }
    });

  } catch (error) {
    console.error('❌ Generate salary slip error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Get salary slips for an employee
const getEmployeeSalarySlips = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // First verify the employee belongs to the same company
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Apply company isolation
    if (employee.company_id !== currentUser.company_id) {
      return res.status(403).json({ error: 'Access denied to this employee' });
    }

    const { data: salarySlips, error } = await supabaseAdmin
      .from('salary_slips')
      .select(`
        *,
        employee:employees(full_name, email, employee_id)
      `)
      .eq('employee_id', employee_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ salarySlips });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get salary slip details
const getSalarySlipDetails = async (req, res) => {
  try {
    const { slip_id } = req.params;
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get salary slip with employee details
    const { data: salarySlip, error: slipError } = await supabaseAdmin
      .from('salary_slips')
      .select(`
        *,
        employee:employees(full_name, email, employee_id, department, designation, company_id)
      `)
      .eq('id', slip_id)
      .single();

    if (slipError || !salarySlip) {
      return res.status(404).json({ error: 'Salary slip not found' });
    }

    // Apply company isolation
    if (salarySlip.employee.company_id !== currentUser.company_id) {
      return res.status(403).json({ error: 'Access denied to this salary slip' });
    }

    // Get salary slip details
    const { data: details, error: detailsError } = await supabaseAdmin
      .from('salary_slip_details')
      .select('*')
      .eq('salary_slip_id', slip_id)
      .order('component_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (detailsError) {
      return res.status(500).json({ error: detailsError.message });
    }

    res.json({
      salarySlip,
      details
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all salary slips (for HR dashboard)
const getAllSalarySlips = async (req, res) => {
  try {
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = supabaseAdmin
      .from('salary_slips')
      .select(`
        *,
        employee:employees(full_name, email, employee_id, department)
      `)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(50);

    // Apply company isolation for ALL users (including admin)
    query = query.eq('company_id', currentUser.company_id);

    const { data: salarySlips, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ salarySlips });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get employee fixed deductions
const getEmployeeFixedDeductionsList = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // First verify the employee belongs to the same company
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Apply company isolation
    if (employee.company_id !== currentUser.company_id) {
      return res.status(403).json({ error: 'Access denied to this employee' });
    }

    const deductions = await getEmployeeFixedDeductions(employee_id);
    res.json({ deductions });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add employee fixed deduction
const addEmployeeFixedDeduction = async (req, res) => {
  try {
    const { employee_id, deduction_name, deduction_type, amount, percentage, description } = req.body;
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields
    if (!employee_id || !deduction_name || !deduction_type) {
      return res.status(400).json({ error: 'Employee ID, deduction name, and type are required' });
    }

    // First verify the employee belongs to the same company
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Apply company isolation
    if (employee.company_id !== currentUser.company_id) {
      return res.status(403).json({ error: 'Access denied to this employee' });
    }

    if (!['fixed', 'percentage'].includes(deduction_type)) {
      return res.status(400).json({ error: 'Deduction type must be fixed or percentage' });
    }

    if (deduction_type === 'fixed' && !amount) {
      return res.status(400).json({ error: 'Amount is required for fixed deductions' });
    }

    if (deduction_type === 'percentage' && !percentage) {
      return res.status(400).json({ error: 'Percentage is required for percentage deductions' });
    }

    // Check if a deduction with the same name already exists for this employee
    const { data: existingDeduction, error: checkError } = await supabaseAdmin
      .from('employee_fixed_deductions')
      .select('id, deduction_name, amount, percentage, is_active')
      .eq('employee_id', employee_id)
      .eq('deduction_name', deduction_name)
      .single();

    if (existingDeduction) {
      // If deduction exists, update it instead of creating a duplicate
      const updateData = {
        deduction_type,
        amount: amount || 0,
        percentage: percentage || 0,
        description,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { data: updatedDeduction, error: updateError } = await supabaseAdmin
        .from('employee_fixed_deductions')
        .update(updateData)
        .eq('id', existingDeduction.id)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({
        message: 'Fixed deduction updated successfully (replaced existing deduction with same name)',
        deduction: updatedDeduction
      });
    }

    // If no existing deduction, create a new one
    const { data: deduction, error } = await supabaseAdmin
      .from('employee_fixed_deductions')
      .insert([{
        employee_id,
        deduction_name,
        deduction_type,
        amount: amount || 0,
        percentage: percentage || 0,
        description,
        created_by: currentUser.id,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Fixed deduction added successfully',
      deduction
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update employee fixed deduction
const updateEmployeeFixedDeduction = async (req, res) => {
  try {
    const { deduction_id } = req.params;
    const { deduction_name, deduction_type, amount, percentage, description, is_active } = req.body;
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // First verify the deduction belongs to an employee in the same company
    const { data: deductionWithEmployee, error: checkError } = await supabaseAdmin
      .from('employee_fixed_deductions')
      .select(`
        *,
        employees!inner(company_id)
      `)
      .eq('id', deduction_id)
      .single();

    if (checkError || !deductionWithEmployee) {
      return res.status(404).json({ error: 'Deduction not found' });
    }

    // Apply company isolation
    if (deductionWithEmployee.employees.company_id !== currentUser.company_id) {
      return res.status(403).json({ error: 'Access denied to this deduction' });
    }

    const updateData = {
      deduction_name,
      deduction_type,
      amount: amount || 0,
      percentage: percentage || 0,
      description,
      is_active
    };

    const { data: deduction, error } = await supabaseAdmin
      .from('employee_fixed_deductions')
      .update(updateData)
      .eq('id', deduction_id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: 'Fixed deduction updated successfully',
      deduction
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete employee fixed deduction
const deleteEmployeeFixedDeduction = async (req, res) => {
  try {
    const { deduction_id } = req.params;
    const currentUser = req.user;

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error } = await supabaseAdmin
      .from('employee_fixed_deductions')
      .delete()
      .eq('id', deduction_id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Fixed deduction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get salary slips for current employee (for employee dashboard)
const getMySalarySlips = async (req, res) => {
  try {
    const currentUser = req.user;

    // Get employee ID for current user
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('user_id', currentUser.id)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { data: salarySlips, error } = await supabaseAdmin
      .from('salary_slips')
      .select(`
        *,
        employee:employees(full_name, email, employee_id, department, designation)
      `)
      .eq('employee_id', employee.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ salarySlips: salarySlips || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get salary slip details for current employee
const getMySalarySlipDetails = async (req, res) => {
  try {
    const { slip_id } = req.params;
    const currentUser = req.user;

    // Get employee ID for current user
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('user_id', currentUser.id)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get salary slip with employee details (only if it belongs to current employee)
    const { data: salarySlip, error: slipError } = await supabaseAdmin
      .from('salary_slips')
      .select(`
        *,
        employee:employees(full_name, email, employee_id, department, designation)
      `)
      .eq('id', slip_id)
      .eq('employee_id', employee.id)
      .single();

    if (slipError || !salarySlip) {
      return res.status(404).json({ error: 'Salary slip not found' });
    }

    // Get salary slip details
    const { data: details, error: detailsError } = await supabaseAdmin
      .from('salary_slip_details')
      .select('*')
      .eq('salary_slip_id', slip_id)
      .order('component_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (detailsError) {
      return res.status(500).json({ error: detailsError.message });
    }

    res.json({
      salarySlip,
      details: details || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Download salary slip for current employee
const downloadMySalarySlip = async (req, res) => {
  try {
    const { slip_id } = req.params;
    const currentUser = req.user;

    // Get employee ID for current user
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, full_name, email, employee_id, department, designation')
      .eq('user_id', currentUser.id)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get salary slip with employee details (only if it belongs to current employee)
    const { data: salarySlip, error: slipError } = await supabaseAdmin
      .from('salary_slips')
      .select(`
        *,
        employee:employees(full_name, email, employee_id, department, designation)
      `)
      .eq('id', slip_id)
      .eq('employee_id', employee.id)
      .single();

    if (slipError || !salarySlip) {
      return res.status(404).json({ error: 'Salary slip not found' });
    }

    // Get salary slip details
    const { data: details, error: detailsError } = await supabaseAdmin
      .from('salary_slip_details')
      .select('*')
      .eq('salary_slip_id', slip_id)
      .order('component_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (detailsError) {
      return res.status(500).json({ error: detailsError.message });
    }

    // Generate HTML
    try {
      const htmlBuffer = await generateSalarySlipPDF(salarySlip, employee, details || []);
      
      // Set response headers for HTML download
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="salary_slip_${employee.full_name.replace(/\s+/g, '_')}_${new Date(salarySlip.year, salarySlip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).replace(/\s+/g, '_')}.html"`);
      
      res.send(htmlBuffer);
    } catch (htmlError) {
      return res.status(500).json({ error: 'Failed to generate HTML' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Download salary slip PDF (for HR users)
const downloadSalarySlip = async (req, res) => {
  try {
    const { id } = req.params
    const currentUser = req.user

    console.log('🔍 downloadSalarySlip called with:', {
      salarySlipId: id,
      currentUser: {
        id: currentUser.id,
        role: currentUser.role,
        company_id: currentUser.company_id
      }
    })

    // Check if user has permission
    if (!['admin', 'hr_manager', 'hr'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get the salary slip with employee details
    let query = supabaseAdmin
      .from('salary_slips')
      .select(`
        *,
        employee:employees!inner (
          id,
          full_name,
          email,
          department,
          designation,
          company_id
        )
      `)
      .eq('id', id)

    // Apply company isolation for non-admin users
    if (currentUser.role !== 'admin') {
      query = query.eq('employee.company_id', currentUser.company_id)
    }

    const { data: salarySlip, error: fetchError } = await query.single()

    if (fetchError || !salarySlip) {
      console.error('❌ Salary slip not found or access denied:', fetchError)
      return res.status(404).json({ error: 'Salary slip not found or access denied' })
    }

    console.log('✅ Salary slip access verified, generating PDF...')

    // Get salary slip details
    const { data: details, error: detailsError } = await supabaseAdmin
      .from('salary_slip_details')
      .select('*')
      .eq('salary_slip_id', id)
      .order('component_type', { ascending: true })
      .order('created_at', { ascending: true })

    if (detailsError) {
      console.error('❌ Failed to fetch salary slip details:', detailsError)
      return res.status(500).json({ error: 'Failed to fetch salary slip details' })
    }

    // Generate HTML using the same approach as document generation
    const htmlBuffer = await generateSalarySlipPDF(salarySlip, salarySlip.employee, details || [])

    if (!htmlBuffer) {
      return res.status(500).json({ error: 'Failed to generate HTML' })
    }

    // Set response headers for HTML download
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const monthName = monthNames[salarySlip.month - 1]
    const year = salarySlip.year
    const filename = `salary_slip_${salarySlip.employee.full_name.replace(/\s+/g, '_')}_${monthName}_${year}.html`

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', htmlBuffer.length)

    console.log('✅ HTML generated successfully, sending response...')
    res.send(htmlBuffer)

  } catch (error) {
    console.error('❌ Download salary slip error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  getSalaryComponents,
  addSalaryComponent,
  getEmployeeFixedDeductions,
  generateSalarySlip,
  getEmployeeSalarySlips,
  getSalarySlipDetails,
  getAllSalarySlips,
  getEmployeeFixedDeductionsList,
  addEmployeeFixedDeduction,
  updateEmployeeFixedDeduction,
  deleteEmployeeFixedDeduction,
  getMySalarySlips,
  getMySalarySlipDetails,
  downloadMySalarySlip,
  downloadSalarySlip,
  getUnpaidLeaveDaysForMonth,
  regenerateSalarySlip
}; 