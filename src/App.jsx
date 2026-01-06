import { useState, useEffect } from 'react';
import { Card, InputNumber, Select, Button, List, Divider, Typography, Space, DatePicker, Row, Col, message, Tabs } from 'antd';
const { RangePicker } = DatePicker;
import { DeleteOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './App.css';
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
  
  // 计算历史
  const [history, setHistory] = useState([]);
  
  // 实时计算
  useEffect(() => {
    calculateResults();
  }, [calculationType, initialInvestment, startDate, finalAmount, endDate, investments, monthlyInvestment, expectedAnnualRate, investmentPeriod, investmentFrequency, currentAmount]);
  
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
        
        // 准备现金流数组
        const cashFlows = [];
        cashFlows.push(-initialInvestment);
        
        // 添加中间投资
        investments.forEach(investment => {
          const daysFromStart = Math.ceil((investment.date.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
          const periodIndex = Math.max(0, Math.floor(daysFromStart / 30));
          
          while (cashFlows.length <= periodIndex) {
            cashFlows.push(0);
          }
          
          cashFlows[periodIndex] -= investment.amount;
        });
        
        // 添加结束金额
        const finalPeriodIndex = Math.max(investments.length, Math.ceil(daysDiff / 30));
        while (cashFlows.length <= finalPeriodIndex) {
          cashFlows.push(0);
        }
        cashFlows[finalPeriodIndex] += finalAmount;
        
        // 计算IRR（月度收益率）
        const monthlyIRR = calculateIRR(cashFlows) / 100;
        
        // 将月度IRR转换为年化收益率
        const annualYield = (Math.pow(1 + monthlyIRR, 12) - 1) * 100;
        
        // 计算投资天数
        const days = Math.ceil((endDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
        
        setResults({ annualYield, totalInvestment, totalReturn, finalAmount, days });
      } else if (calculationType === 'sip') {
        // 定投计算：根据初始金额、定投金额、投资期限、投资频率和当前金额，计算年化收益率
        
        // 从投资期限范围中提取开始和结束日期
        const [startDate, endDate] = investmentPeriod;
        
        // 计算投资月数
        const investmentMonths = endDate.diff(startDate, 'month');
        
        // 计算年化收益率
        const annualYield = calculateSIPYield(sipInitialInvestment, monthlyInvestment, investmentMonths, investmentFrequency, currentAmount);
        
        // 计算总投入
        const annualInvestment = monthlyInvestment * 12;
        const totalInvestment = sipInitialInvestment + (annualInvestment * (investmentMonths / 12));
        
        // 计算总收益
        const totalReturn = currentAmount - totalInvestment;
        
        // 计算投资天数
        const days = Math.ceil((endDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24));
        
        setResults({ 
          annualYield, 
          totalInvestment, 
          totalReturn, 
          finalAmount: currentAmount,
          days
        });
      }
    } catch (error) {
      message.error('计算失败，请检查输入数据');
      setResults({ annualYield: 0, totalInvestment: 0, totalReturn: 0, finalAmount: 0, days: 0 });
    }
  };
  
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
      setHistory(JSON.parse(savedHistory));
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
                      onChange={(date) => setStartDate(date || new Date())}
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
                
                {investments.map((investment, index) => (
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
                      onChange={(date) => updateInvestment(investment.id, 'date', date || new Date())}
                      disabledDate={(current) => current && (current < startDate || current > endDate)}
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
                      onChange={(date) => setEndDate(date || new Date())}
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
                      onChange={setInvestmentPeriod}
                      style={{ width: '100%' }}
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
                  <Text strong>投资时间：</Text>
                  <Text className="result-value">{results.days} 天</Text>
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
                        <div>年化收益率：{formatPercent(item.results.annualYield)}</div>
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
                      </>
                    ) : (
                      <>
                        <div>{getFrequencyName(item.investmentFrequency)}定投：{formatAmount(item.monthlyInvestment)}，预期年化：{formatPercent(item.expectedAnnualRate)}，投资期限：{item.investmentMonths}个月</div>
                        <div>总投入：{formatAmount(item.results.totalInvestment)} | 总收益：{formatAmount(item.results.totalReturn)}</div>
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
    </div>
  );
}

export default App;