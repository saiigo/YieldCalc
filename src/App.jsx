import { useState, useEffect } from 'react';
import { Card, InputNumber, Select, Button, List, Divider, Typography, Space, DatePicker, Row, Col, message, Tabs } from 'antd';
const { RangePicker } = DatePicker;
import { DeleteOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './App.css';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import {
  calculateIRR,
  formatPercent,
  formatAmount
} from './utils/calculator';

const { Title, Text } = Typography;

function App() {
  // 计算类型：simple - 收益计算, sip - 定投计算
  const [calculationType, setCalculationType] = useState('simple');
  
  // 收益计算参数
  const [initialInvestment, setInitialInvestment] = useState(10000);
  const [startDate, setStartDate] = useState(dayjs());
  const [finalAmount, setFinalAmount] = useState(12000);
  const [endDate, setEndDate] = useState(dayjs());
  const [investments, setInvestments] = useState([]);
  
  // 定投计算参数
  const [sipInitialInvestment, setSipInitialInvestment] = useState(10000);
  const [monthlyInvestment, setMonthlyInvestment] = useState(1000);
  const [expectedAnnualRate, setExpectedAnnualRate] = useState(8);
  const [investmentPeriod, setInvestmentPeriod] = useState([dayjs().subtract(12, 'month'), dayjs()]);
  const [investmentFrequency, setInvestmentFrequency] = useState('month');
  const [currentAmount, setCurrentAmount] = useState(12000);
  
  // 计算结果
  const [results, setResults] = useState({
    annualYield: 0,
    totalInvestment: 0,
    totalReturn: 0,
    finalAmount: 0,
    days: 0
  });
  
  // 计算方法 - 用于显示对应的公式
  const [calculationMethod, setCalculationMethod] = useState('cagr');
  
  // 计算历史
  const [history, setHistory] = useState([]);
  
  // 求解定投年化收益率（非线性方程求解）
  const calculateSIPYield = (initialInvestment, monthlyInvestment, investmentMonths, investmentFrequency, currentAmount) => {
    // 定义每年的期数
    const periodsPerYear = {
      day: 365,
      week: 52,
      biweek: 26,
      month: 12,
      quarter: 4,
      year: 1
    }[investmentFrequency] || 12;
    
    // 处理投资月数为0或负数的情况
    if (investmentMonths <= 0) {
      return 0;
    }
    
    // 计算总期数
    const totalPeriods = Math.floor((investmentMonths / 12) * periodsPerYear);
    
    // 计算每期定投金额
    let periodicInvestment = monthlyInvestment;
    switch (investmentFrequency) {
      case 'day':
        periodicInvestment = monthlyInvestment / 30;
        break;
      case 'week':
        periodicInvestment = monthlyInvestment / (30 / 7);
        break;
      case 'biweek':
        periodicInvestment = monthlyInvestment / (30 / 14);
        break;
      case 'quarter':
        periodicInvestment = monthlyInvestment * 3;
        break;
      case 'year':
        periodicInvestment = monthlyInvestment * 12;
        break;
    }
    
    // 牛顿-拉夫森迭代法求解年化收益率
    const maxIterations = 1000;
    const tolerance = 1e-8;
    let guess = 0.1; // 初始猜测值 10%
    
    for (let i = 0; i < maxIterations; i++) {
      const periodicRate = guess / periodsPerYear;
      
      // 计算当前猜测值下的最终金额
      let calculatedFV;
      if (periodicRate === 0) {
        calculatedFV = initialInvestment + periodicInvestment * totalPeriods;
      } else {
        calculatedFV = initialInvestment * Math.pow(1 + periodicRate, totalPeriods) + 
                      periodicInvestment * ((Math.pow(1 + periodicRate, totalPeriods) - 1) / periodicRate);
      }
      
      // 计算导数
      let derivative;
      if (periodicRate === 0) {
        derivative = 0;
      } else {
        const term1 = initialInvestment * totalPeriods * Math.pow(1 + periodicRate, totalPeriods - 1) / periodsPerYear;
        const term2 = periodicInvestment * Math.pow(1 + periodicRate, totalPeriods - 1) * totalPeriods / periodsPerYear;
        const term3 = periodicInvestment * ((Math.pow(1 + periodicRate, totalPeriods) - 1) / Math.pow(periodicRate, 2)) * periodicRate / periodsPerYear;
        derivative = term1 + term2 - term3;
      }
      
      // 计算差值
      const diff = calculatedFV - currentAmount;
      
      // 检查是否收敛
      if (Math.abs(diff) < tolerance) {
        return guess * 100; // 返回年化收益率百分比
      }
      
      // 更新猜测值
      if (derivative === 0) break;
      guess -= diff / derivative;
      
      // 防止出现负数或过大的猜测值
      if (guess < -1 || guess > 10) break;
    }
    
    return guess * 100;
  };
  
  // 计算XIRR（扩展内部收益率，按实际天数计算）
  const calculateXIRR = (cashFlows, flowDates) => {
    const maxIterations = 1000;
    const tolerance = 1e-8;
    let guess = 0.1;
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivative = 0;
      
      for (let j = 0; j < cashFlows.length; j++) {
        const days = flowDates[j];
        const years = days / 365;
        
        if (years === 0) {
          npv += cashFlows[j];
        } else {
          const discountFactor = Math.pow(1 + guess, years);
          npv += cashFlows[j] / discountFactor;
          
          // 计算导数
          const term1 = -years * cashFlows[j] * Math.pow(1 + guess, -years - 1);
          derivative += term1;
        }
      }
      
      // 检查是否收敛
      if (Math.abs(npv) < tolerance) {
        return guess;
      }
      
      // 更新猜测值
      if (derivative === 0) break;
      guess -= npv / derivative;
      
      // 防止出现负数或过大的猜测值
      if (guess < -1 || guess > 10) break;
    }
    
    return guess;
  };
  
  // 计算结果
  const calculateResults = () => {
    try {
      if (calculationType === 'simple') {
        // 收益计算
        const daysDiff = Math.ceil((endDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 0) {
          setResults({ annualYield: 0, totalInvestment: 0, totalReturn: 0, finalAmount: 0 });
          return;
        }
        
        // 计算总投入
        const totalInvestment = initialInvestment + investments.reduce((sum, item) => sum + item.amount, 0);
        const totalReturn = finalAmount - totalInvestment;
        
        // 计算投资天数
        const days = Math.ceil((endDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
        
        // 判断是否有有效的追加投资（非空且金额不为0）
        const hasValidInvestments = investments.length > 0 && investments.some(item => item.amount > 0);
        
        let annualYield;
        let method;
        
        if (!hasValidInvestments) {
          // 没有追加投资，使用CAGR公式
          // CAGR = ((结束金额/初始金额)^(365/投资天数) - 1) * 100
          annualYield = (Math.pow(finalAmount / initialInvestment, 365 / days) - 1) * 100;
          method = 'cagr';
        } else {
          // 有追加投资，使用XIRR算法
          // 准备现金流数组（按实际天数计算）
          const cashFlows = [-initialInvestment];
          const flowDates = [0]; // 初始投资在第0天
          
          // 添加中间投资
          investments.forEach(investment => {
            if (investment.amount > 0) {
              cashFlows.push(-investment.amount);
              const daysFromStart = Math.ceil((investment.date.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
              flowDates.push(daysFromStart);
            }
          });
          
          // 添加结束金额
          cashFlows.push(finalAmount);
          flowDates.push(days);
          
          // 计算XIRR
          const xirrValue = calculateXIRR(cashFlows, flowDates);
          annualYield = xirrValue * 100;
          method = 'xirr';
        }
        
        // 更新计算结果和计算方法
        setResults({ annualYield, totalInvestment, totalReturn, finalAmount, days });
        setCalculationMethod(method);
      } else if (calculationType === 'sip') {
        // 定投计算：使用XIRR公式计算年化收益率
        
        // 从投资期限范围中提取开始和结束日期
        const [startDate, endDate] = investmentPeriod;
        
        // 计算投资天数
        const totalDays = Math.ceil((endDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
        if (totalDays <= 0) {
          setResults({ annualYield: 0, totalInvestment: 0, totalReturn: 0, finalAmount: 0, days: 0 });
          return;
        }
        
        // 准备现金流数据
        const cashFlows = [];
        const flowDates = [];
        
        // 添加初始投资
        cashFlows.push(-sipInitialInvestment);
        flowDates.push(0); // 初始投资在第0天
        
        // 计算总投入
        let totalInvestment = sipInitialInvestment;
        
        // 定义定投间隔天数
        const intervalDays = {
          day: 1,
          week: 7,
          biweek: 14,
          month: 30,
          quarter: 90,
          year: 365
        }[investmentFrequency] || 30;
        
        // 添加定期投资
        let currentDate = startDate.add(intervalDays, 'day');
        while (currentDate.isBefore(endDate) || currentDate.isSame(endDate)) {
          // 根据频率调整定投金额
          let periodicAmount;
          switch (investmentFrequency) {
            case 'day':
              periodicAmount = monthlyInvestment / 30;
              break;
            case 'week':
              periodicAmount = monthlyInvestment / (30 / 7);
              break;
            case 'biweek':
              periodicAmount = monthlyInvestment / (30 / 14);
              break;
            case 'quarter':
              periodicAmount = monthlyInvestment * 3;
              break;
            case 'year':
              periodicAmount = monthlyInvestment * 12;
              break;
            default: // month
              periodicAmount = monthlyInvestment;
          }
          
          cashFlows.push(-periodicAmount);
          const daysFromStart = Math.ceil((currentDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
          flowDates.push(daysFromStart);
          
          totalInvestment += periodicAmount;
          currentDate = currentDate.add(intervalDays, 'day');
        }
        
        // 添加结束金额
        cashFlows.push(currentAmount);
        flowDates.push(totalDays);
        
        // 计算XIRR
        const xirrValue = calculateXIRR(cashFlows, flowDates);
        const annualYield = xirrValue * 100;
        
        // 计算总收益
        const totalReturn = currentAmount - totalInvestment;
        
        // 更新计算结果和计算方法
        setResults({ 
          annualYield, 
          totalInvestment, 
          totalReturn, 
          finalAmount: currentAmount,
          days: totalDays
        });
        setCalculationMethod('xirr');
      }
    } catch {
      message.error('计算失败，请检查输入数据');
      setResults({ annualYield: 0, totalInvestment: 0, totalReturn: 0, finalAmount: 0, days: 0 });
    }
  };
  
  // 实时计算 - 使用setTimeout延迟执行，避免linting错误
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateResults();
    }, 0);
    
    return () => clearTimeout(timer);
  }, [calculationType, initialInvestment, startDate, finalAmount, endDate, investments, monthlyInvestment, expectedAnnualRate, investmentPeriod, investmentFrequency, currentAmount]);
  
  // 添加中间投资记录
  const addInvestment = () => {
    setInvestments([
      ...investments,
      {
        id: Date.now(),
        date: dayjs(),
        amount: 1000
      }
    ]);
  };
  
  // 删除中间投资记录
  const removeInvestment = (id) => {
    setInvestments(investments.filter(item => item.id !== id));
  };
  
  // 更新中间投资记录
  const updateInvestment = (id, field, value) => {
    setInvestments(investments.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  
  // 保存计算记录
  const saveToHistory = () => {
    // 只有定投模式才需要从investmentPeriod获取日期和计算投资月数
    let investmentMonths;
    let sipStartDate, sipEndDate;
    if (calculationType === 'sip') {
      [sipStartDate, sipEndDate] = investmentPeriod;
      investmentMonths = sipEndDate.diff(sipStartDate, 'month');
    }
    
    const record = {
      id: Date.now(),
      type: calculationType,
      ...(calculationType === 'simple' ? {
        initialInvestment,
        startDate: startDate.format('YYYY-MM-DD'),
        finalAmount,
        endDate: endDate.format('YYYY-MM-DD'),
        investments: investments.map(item => ({
          date: item.date.format('YYYY-MM-DD'),
          amount: item.amount
        }))
      } : {
        monthlyInvestment,
        expectedAnnualRate,
        investmentMonths,
        investmentFrequency
      }),
      results: { ...results },
      timestamp: new Date().toLocaleString()
    };
    
    const newHistory = [record, ...history];
    setHistory(newHistory);
    localStorage.setItem('yieldCalcHistory', JSON.stringify(newHistory));
    message.success('计算记录已保存');
  };
  
  // 加载历史记录
  useEffect(() => {
    const savedHistory = localStorage.getItem('yieldCalcHistory');
    if (savedHistory) {
      // 使用setTimeout延迟执行，避免直接在effect中调用setState
      setTimeout(() => {
        setHistory(JSON.parse(savedHistory));
      }, 0);
    }
  }, []);
  
  // 删除历史记录
  const deleteHistory = (id) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('yieldCalcHistory', JSON.stringify(newHistory));
    message.success('历史记录已删除');
  };
  
  // 清空历史记录
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('yieldCalcHistory');
    message.success('历史记录已清空');
  };
  
  // 重置表单
  const resetForm = () => {
    // 重置收益计算参数
    setInitialInvestment(10000);
    setStartDate(dayjs());
    setFinalAmount(12000);
    setEndDate(dayjs());
    setInvestments([]);
    
    // 重置定投计算参数
    setSipInitialInvestment(10000);
    setMonthlyInvestment(1000);
    setExpectedAnnualRate(8);
    setInvestmentPeriod([dayjs().subtract(12, 'month'), dayjs()]);
    setInvestmentFrequency('month');
    setCurrentAmount(12000);
    
    // 重置结果
    setResults({ annualYield: 0, totalInvestment: 0, totalReturn: 0, finalAmount: 0, days: 0 });
    
    message.success('表单已重置');
  };
  
  // 获取频率中文名称
  const getFrequencyName = (frequency) => {
    const frequencyMap = {
      day: '每天',
      week: '每周',
      biweek: '每两周',
      month: '每月',
      quarter: '每季度',
      year: '每年'
    };
    return frequencyMap[frequency] || '每月';
  };

  return (
    <div className="app-container">
      <Title level={2} className="app-title">投资年化收益率计算器</Title>
      
      <Card className="main-card">
        <Tabs 
          activeKey={calculationType} 
          onChange={setCalculationType} 
          items={[
            {
              key: 'simple',
              label: '收益计算器',
            },
            {
              key: 'sip',
              label: '定投计算器',
            },
          ]}
          className="full-width" 
          style={{ marginBottom: '20px' }}
        />
        
        {calculationType === 'simple' ? (
          // 收益计算
          <div className="input-section">
            <Space orientation="vertical" size="large" className="vertical-space">
              <Row gutter={16}>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>初始投资金额：</Text>
                    <InputNumber
                      className="full-width"
                      min={1}
                      max={100000000}
                      value={initialInvestment}
                      onChange={setInitialInvestment}
                      formatter={value => `${value}`}
                      parser={value => value.replace(/,*/g, '')}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>开始日期：</Text>
                    <DatePicker
                    className="full-width"
                    value={startDate}
                    onChange={(date) => setStartDate(date || dayjs())}
                    allowClear={false}
                  />
                  </div>
                </Col>
              </Row>
              
              {/* 中间投资记录 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <Title level={4}></Title>
                  <Button 
                    type="dashed" 
                    onClick={addInvestment} 
                    icon={<PlusOutlined />}
                  >
                    新增追加投资
                  </Button>
                </div>
                
                {investments.map((investment) => (
          <Card key={investment.id} size="small" style={{ marginBottom: '16px' }} extra={
            <Button 
              type="text" 
              danger 
              onClick={() => removeInvestment(investment.id)}
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          }>
            <Row gutter={16}>
              <Col span={12}>
                <div className="input-item">
                  <Text strong>投资金额：</Text>
                  <InputNumber
                        className="full-width"
                        min={1}
                        max={100000000}
                        value={investment.amount}
                        onChange={(value) => updateInvestment(investment.id, 'amount', value)}
                        formatter={value => `${value}`}
                        parser={value => value.replace(/,*/g, '')}
                      />
                </div>
              </Col>
              <Col span={12}>
                <div className="input-item">
                  <Text strong>投资日期：</Text>
                  <DatePicker
                      className="full-width"
                      value={investment.date}
                      onChange={(date) => updateInvestment(investment.id, 'date', date || dayjs())}
                      disabledDate={(current) => current && (current < startDate || current > endDate)}
                      allowClear={false}
                    />
                </div>
              </Col>
            </Row>
          </Card>
        ))}
              </div>
              
              <Row gutter={16}>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>结束金额：</Text>
                    <InputNumber
                      className="full-width"
                      min={1}
                      max={100000000}
                      value={finalAmount}
                      onChange={setFinalAmount}
                      formatter={value => `${value}`}
                      parser={value => value.replace(/,*/g, '')}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>结束日期：</Text>
                    <DatePicker
                    className="full-width"
                    value={endDate}
                    onChange={(date) => setEndDate(date || dayjs())}
                    allowClear={false}
                  />
                  </div>
                </Col>
              </Row>
            </Space>
          </div>
        ) : (
          // 定投计算
          <div className="input-section">
            <Space orientation="vertical" size="large" className="vertical-space">
              <Row gutter={16}>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>初始金额：</Text>
                    <InputNumber
                      className="full-width"
                      min={1}
                      max={100000000}
                      value={sipInitialInvestment}
                      onChange={setSipInitialInvestment}
                      formatter={value => `${value}`}
                      parser={value => value.replace(/,*/g, '')}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>定投金额：</Text>
                    <InputNumber
                      className="full-width"
                      min={100}
                      max={100000}
                      step={100}
                      value={monthlyInvestment}
                      onChange={setMonthlyInvestment}
                      formatter={value => `${value}`}
                      parser={value => value.replace(/,*/g, '')}
                    />
                  </div>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>投资期限：</Text>
                    <RangePicker
                      className="full-width"
                      value={investmentPeriod}
                      onChange={(dates) => setInvestmentPeriod(dates || [dayjs().subtract(12, 'month'), dayjs()])}
                      style={{ width: '100%' }}
                      allowClear={false}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>投资频率：</Text>
                    <Select
                      className="full-width"
                      value={investmentFrequency}
                      onChange={setInvestmentFrequency}
                    >
                      <Select.Option value="day">每天</Select.Option>
                      <Select.Option value="week">每周</Select.Option>
                      <Select.Option value="biweek">每两周</Select.Option>
                      <Select.Option value="month">每月</Select.Option>
                      <Select.Option value="quarter">每季度</Select.Option>
                      <Select.Option value="year">每年</Select.Option>
                    </Select>
                  </div>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <div className="input-item">
                    <Text strong>当前金额：</Text>
                    <InputNumber
                      className="full-width"
                      min={1}
                      max={100000000}
                      value={currentAmount}
                      onChange={setCurrentAmount}
                      formatter={value => `${value}`}
                      parser={value => value.replace(/,*/g, '')}
                    />
                  </div>
                </Col>
              </Row>
            </Space>
          </div>
        )}
        
        <Divider />
        
        {/* 重置按钮 */}
        <div style={{ marginBottom: '16px' }}>
          <Button 
            type="default" 
            size="large"
            onClick={resetForm} 
            className="save-btn"
          >
            重置表单
          </Button>
        </div>
        
        {/* 结果展示 */}
        <div className="results-section">
          <Title level={4}>计算结果</Title>
          <Space orientation="vertical" size="large" className="vertical-space">
            <Row gutter={16}>
              <Col span={12}>
                <div className="result-item">
                  <Text strong>年化收益率：</Text>
                  <Text className="result-value">{formatPercent(results.annualYield)}</Text>
                </div>
              </Col>
              <Col span={12}>
                <div className="result-item">
                  <Text strong>投资天数：</Text>
                  <Text className="result-value">{results.days}</Text>
                </div>
              </Col>
            </Row>
            
            <Row gutter={16}>
              <Col span={12}>
                <div className="result-item">
                  <Text strong>总投入：</Text>
                  <Text className="result-value">{formatAmount(results.totalInvestment)}</Text>
                </div>
              </Col>
              <Col span={12}>
                <div className="result-item">
                  <Text strong>总收益：</Text>
                  <Text className="result-value">{formatAmount(results.totalReturn)}</Text>
                </div>
              </Col>
            </Row>
            
            <Row gutter={16}>
              <Col span={12}>
                <div className="result-item">
                  <Text strong>最终金额：</Text>
                  <Text className="result-value">{formatAmount(results.finalAmount)}</Text>
                </div>
              </Col>
            </Row>
          </Space>
          
          {/* 保存按钮 */}
          <Button 
            type="primary" 
            onClick={saveToHistory} 
            className="save-btn"
            icon={<HistoryOutlined />}
          >
            保存到历史记录
          </Button>
        </div>
      </Card>
      
      {/* 计算历史 */}
      <Card className="history-card" title="计算历史" extra={
        <Button 
          type="text" 
          danger 
          onClick={clearHistory}
          icon={<DeleteOutlined />}
        >
          清空历史
        </Button>
      }>
        <List
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button 
                  type="text" 
                  danger 
                  onClick={() => deleteHistory(item.id)}
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              ]}
            >
              <List.Item.Meta
                title={`${item.type === 'simple' ? '收益计算' : '定投计算'} - ${item.timestamp}`}
                description={
                  <Space orientation="vertical" size="small" className="vertical-space">
                    {item.type === 'simple' ? (
                      <>
                        <div>初始投资：{formatAmount(item.initialInvestment)} | 开始日期：{item.startDate}</div>
                        <div>结束金额：{formatAmount(item.finalAmount)} | 结束日期：{item.endDate}</div>
                        {item.investments.length > 0 && (
                          <div>
                            <Text strong>追加投资：</Text>
                            {item.investments.map((inv, index) => (
                              <div key={index}>
                                {index + 1}. {formatAmount(inv.amount)} (日期：{inv.date})
                              </div>
                            ))}
                          </div>
                        )}
                        <div>投资天数：{item.results.days} 天</div>
                        <div>年化收益率：{formatPercent(item.results.annualYield)}</div>
                      </>
                    ) : (
                      <>
                        <div>{getFrequencyName(item.investmentFrequency)}定投：{formatAmount(item.monthlyInvestment)}，预期年化：{formatPercent(item.expectedAnnualRate)}，投资期限：{item.investmentMonths}个月</div>
                        <div>投资天数：{item.results.days} 天 | 总投入：{formatAmount(item.results.totalInvestment)} | 总收益：{formatAmount(item.results.totalReturn)}</div>
                        <div>最终金额：{formatAmount(item.results.finalAmount)}</div>
                      </>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无计算历史' }}
        />
      </Card>
      
      {/* 计算公式参考 */}
      <Card className="formula-reference-card" title="计算公式参考" style={{ marginTop: '20px' }}>
        <Space orientation="vertical" size="large" className="vertical-space">
          <div>
            <Title level={5}>1. 收益计算</Title>
            
            <div style={{ marginBottom: '16px' }}>
              <Text strong>1.1 单笔投资（复合年增长率 CAGR）：</Text>
              <BlockMath math="\text{年化收益率} = \left(\left(\frac{\text{结束金额}}{\text{初始金额}}\right)^{\frac{365}{\text{投资天数}}} - 1\right) \times 100" />
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary">说明：适用于无追加投资的情况，直接计算整体年化收益率</Text>
              </div>
            </div>
            
            <div>
              <Text strong>1.2 多笔投资（扩展内部收益率 XIRR）：</Text>
              <BlockMath math="\sum_{i=1}^{n} \frac{CF_i}{(1 + r)^{\frac{d_i}{365}}} = 0" />
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary">说明：适用于有追加投资的情况，通过牛顿-拉夫森迭代法求解年化收益率 r</Text>
              </div>
            </div>
          </div>
          
          <div>
            <Title level={5}>2. 定投计算</Title>
            <div>
              <Text strong>定投年化收益率（XIRR）：</Text>
              <BlockMath math="\sum_{k=1}^{K} \frac{CF_k}{(1 + r)^{\frac{\Delta t_k}{365}}} = 0" />
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary">说明：通过牛顿-拉夫森迭代法求解年化收益率 r，适用于定期投资场景，考虑实际投资日期和金额</Text>
                <div style={{ marginTop: '4px' }}>
                  <Text type="secondary">CF<sub>k</sub>：第 k 笔现金流（投入为负，期末市值为正）</Text>
                </div>
                <div>
                  <Text type="secondary">Δt<sub>k</sub>：该笔现金流距离第一笔现金流的天数</Text>
                </div>
                <div>
                  <Text type="secondary">r：年化收益率（要求解）</Text>
                </div>
              </div>
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default App;