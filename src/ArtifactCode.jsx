import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const SpamChecker = () => {
  const [emailText, setEmailText] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [spamTriggerWords, setSpamTriggerWords] = useState([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Default trigger words that will be used if no spreadsheet is provided
  const defaultTriggerWords = [
    { word: 'free', severity: 'medium' },
    { word: 'buy now', severity: 'high' },
    { word: 'click here', severity: 'medium' },
    { word: 'limited time', severity: 'medium' },
    { word: 'urgent', severity: 'medium' },
    { word: 'act now', severity: 'high' },
    { word: 'guarantee', severity: 'low' },
    { word: 'cash', severity: 'medium' },
    { word: 'winner', severity: 'high' },
    { word: 'discount', severity: 'low' },
    { word: 'offer', severity: 'low' },
    { word: 'credit', severity: 'medium' },
    { word: 'investment', severity: 'medium' },
    { word: 'congratulations', severity: 'medium' },
    { word: 'save', severity: 'low' },
    { word: 'risk-free', severity: 'high' },
    { word: 'no obligation', severity: 'medium' },
    { word: 'don\'t delete', severity: 'high' },
    { word: 'million', severity: 'high' },
    { word: '100%', severity: 'medium' }
  ];

  // Set default trigger words on first load
  useEffect(() => {
    setSpamTriggerWords(defaultTriggerWords);
  }, []);

  // Function to fetch and parse Google Sheet
  const fetchGoogleSheet = async () => {
    if (!sheetUrl) {
      setSheetError('Please enter a Google Sheet URL');
      return;
    }

    setIsLoadingSheet(true);
    setSheetError('');
    
    try {
      // Get the sheet ID from the URL
      let sheetId = '';
      if (sheetUrl.includes('/d/')) {
        const urlParts = sheetUrl.split('/d/');
        const idParts = urlParts[1].split('/');
        sheetId = idParts[0];
      } else {
        throw new Error('Invalid Google Sheets URL format');
      }
      
      // Construct the CSV export URL
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      
      // Fetch the CSV
      const response = await fetch(csvUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet. Make sure the sheet is publicly accessible or shared.');
      }
      
      const csvData = await response.text();
      
      // Parse the CSV
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log('Parsed results:', results);
          
          if (results.data && results.data.length > 0) {
            // Check if the CSV has the required columns
            const firstRow = results.data[0];
            if (!firstRow.word || !firstRow.severity) {
              setSheetError('Sheet must contain "word" and "severity" columns');
              setIsLoadingSheet(false);
              return;
            }
            
            // Transform the data to match our expected format
            const parsedTriggerWords = results.data.map(row => ({
              word: row.word.trim().toLowerCase(),
              severity: row.severity.trim().toLowerCase()
            })).filter(row => row.word && (row.severity === 'low' || row.severity === 'medium' || row.severity === 'high'));
            
            if (parsedTriggerWords.length === 0) {
              setSheetError('No valid trigger words found in sheet');
              setIsLoadingSheet(false);
              return;
            }
            
            setSpamTriggerWords(parsedTriggerWords);
            setLastUpdated(new Date().toLocaleString());
            setSheetError('');
          } else {
            setSheetError('No data found in sheet');
          }
          
          setIsLoadingSheet(false);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          setSheetError('Error parsing sheet data');
          setIsLoadingSheet(false);
        }
      });
    } catch (error) {
      console.error('Error fetching Google Sheet:', error);
      setSheetError(error.message || 'Error fetching Google Sheet');
      setIsLoadingSheet(false);
    }
  };

  const analyzeEmail = () => {
    setLoading(true);
    
    // Simulate processing time
    setTimeout(() => {
      const analysis = {
        spamScore: 0,
        triggers: [],
        lengthAnalysis: '',
        subjectLinePresent: false,
        htmlContent: false,
        allCaps: false,
        excessivePunctuation: false,
        imageToTextRatio: 'balanced',
        suggestions: []
      };
      
      // Check for spam trigger words
      spamTriggerWords.forEach(trigger => {
        const regex = new RegExp(`\\b${trigger.word.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        if (regex.test(emailText)) {
          const scoreImpact = 
            trigger.severity === 'high' ? 15 : 
            trigger.severity === 'medium' ? 8 : 3;
          
          analysis.triggers.push({
            word: trigger.word,
            severity: trigger.severity,
            impact: scoreImpact
          });
          
          analysis.spamScore += scoreImpact;
        }
      });
      
      // Check email length
      const wordCount = emailText.split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount < 20) {
        analysis.lengthAnalysis = 'too short';
        analysis.suggestions.push('Email is very short. Consider adding more content to make it appear legitimate.');
      } else if (wordCount > 500) {
        analysis.lengthAnalysis = 'too long';
        analysis.suggestions.push('Email is quite long, which might decrease readability.');
      } else {
        analysis.lengthAnalysis = 'good';
      }
      
      // Check for subject line
      if (emailText.match(/^subject:/i) || emailText.match(/\nsubject:/i)) {
        analysis.subjectLinePresent = true;
      } else {
        analysis.suggestions.push('No subject line detected. Include a clear, non-spammy subject line.');
      }
      
      // Check for HTML content
      if (/<html|<body|<table|<div|<img|<a\s+href/i.test(emailText)) {
        analysis.htmlContent = true;
        analysis.suggestions.push('HTML content detected. Ensure your HTML is well-formed and balanced with text.');
      }
      
      // Check for ALL CAPS
      const capsPercentage = (emailText.match(/[A-Z]/g) || []).length / emailText.length;
      if (capsPercentage > 0.3) {
        analysis.allCaps = true;
        analysis.spamScore += 10;
        analysis.suggestions.push('Excessive use of capital letters detected. Reduce capitals to avoid spam triggers.');
      }
      
      // Check for excessive punctuation
      const exclamationCount = (emailText.match(/!/g) || []).length;
      if (exclamationCount > 3) {
        analysis.excessivePunctuation = true;
        analysis.spamScore += exclamationCount;
        analysis.suggestions.push('Excessive exclamation marks detected. Reduce to improve deliverability.');
      }
      
      // Add general suggestions based on score
      if (analysis.spamScore > 30) {
        analysis.suggestions.push('Your email has a high spam score. Consider rewriting with less promotional language.');
      }
      
      setResults(analysis);
      setLoading(false);
    }, 1000);
  };

  const getScoreColor = (score) => {
    if (score < 15) return 'text-green-600';
    if (score < 30) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getSeverityColor = (severity) => {
    if (severity === 'low') return 'bg-yellow-100 text-yellow-800';
    if (severity === 'medium') return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  // Reset to default trigger words
  const resetToDefaultWords = () => {
    setSpamTriggerWords(defaultTriggerWords);
    setLastUpdated(new Date().toLocaleString() + ' (reset to defaults)');
  };

  return (
    <div className="max-w-full p-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-2">Email Spam Analyzer</h1>
        <p className="text-gray-700">Paste your email copy below to check how likely it is to trigger spam filters</p>
      </div>
      
      {/* Google Sheet Import Section */}
      <div className="mb-6 p-4 border rounded-md bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Custom Trigger Words</h2>
        <p className="text-sm text-gray-600 mb-3">
          Import trigger words from a Google Sheet. The sheet must have two columns: "word" and "severity" (low/medium/high).
          Make sure your sheet is publicly accessible or shared with anyone with the link.
        </p>
        
        <div className="flex flex-col md:flex-row gap-2 mb-2">
          <input
            type="text"
            className="flex-grow p-2 border border-gray-300 rounded-md text-sm"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Enter Google Sheets URL..."
          />
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 text-sm whitespace-nowrap"
            onClick={fetchGoogleSheet}
            disabled={isLoadingSheet || !sheetUrl}
          >
            {isLoadingSheet ? 'Loading...' : 'Import Triggers'}
          </button>
          <button
            className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm whitespace-nowrap"
            onClick={resetToDefaultWords}
          >
            Reset to Defaults
          </button>
        </div>
        
        {sheetError && <p className="text-red-600 text-sm mt-1">{sheetError}</p>}
        
        <div className="mt-2 flex items-center text-sm">
          <span className="text-gray-600 mr-2">Trigger words:</span> 
          <span className="font-semibold">{spamTriggerWords.length}</span>
          {lastUpdated && (
            <span className="ml-4 text-gray-500 text-xs">Last updated: {lastUpdated}</span>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <textarea
          className="w-full p-3 border border-gray-300 rounded-md min-h-64 font-mono text-sm"
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          placeholder="Paste your email content here (including subject line)..."
        />
      </div>
      
      <div className="mb-6">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          onClick={analyzeEmail}
          disabled={!emailText.trim() || loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Email'}
        </button>
      </div>
      
      {results && (
        <div className="border rounded-lg p-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold">Analysis Results</h2>
            <div className="flex items-center mt-2">
              <div className="text-2xl font-bold mr-2">
                <span className={getScoreColor(results.spamScore)}>
                  {results.spamScore}
                </span>
                <span className="text-gray-500 text-lg">/100</span>
              </div>
              <div>
                <span className="text-sm">Spam Score</span>
              </div>
            </div>
          </div>
          
          {results.triggers.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Potential Spam Triggers</h3>
              <div className="flex flex-wrap gap-2">
                {results.triggers.map((trigger, index) => (
                  <span 
                    key={index} 
                    className={`inline-block px-2 py-1 text-xs rounded-full ${getSeverityColor(trigger.severity)}`}
                  >
                    "{trigger.word}" (+{trigger.impact})
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <h3 className="font-semibold mb-1">Content Length</h3>
              <p className={`text-sm ${
                results.lengthAnalysis === 'good' ? 'text-green-600' : 
                results.lengthAnalysis === 'too short' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {results.lengthAnalysis === 'good' ? 'Good length' : 
                 results.lengthAnalysis === 'too short' ? 'Too short' : 'Very long'}
              </p>
            </div>
            
            <div className="border rounded p-3">
              <h3 className="font-semibold mb-1">Formatting</h3>
              <ul className="text-sm">
                <li className={results.allCaps ? 'text-red-600' : 'text-green-600'}>
                  ALL CAPS: {results.allCaps ? 'Excessive' : 'Good'}
                </li>
                <li className={results.excessivePunctuation ? 'text-red-600' : 'text-green-600'}>
                  Punctuation: {results.excessivePunctuation ? 'Excessive' : 'Good'}
                </li>
                <li className={results.htmlContent ? 'text-yellow-600' : 'text-green-600'}>
                  HTML: {results.htmlContent ? 'Present' : 'None detected'}
                </li>
              </ul>
            </div>
          </div>
          
          {results.suggestions.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Improvement Suggestions</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {results.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-500">
            <p>Note: This analysis is based on common spam triggers. Email deliverability depends on many factors including sender reputation, authentication, and recipient-specific filters.</p>
          </div>
        </div>
      )}

      {/* Help Section for Google Sheet Format */}
      <div className="mt-8 p-4 border rounded-md bg-gray-50">
        <h3 className="font-semibold mb-2">How to Set Up Your Google Sheet</h3>
        <p className="text-sm text-gray-600 mb-2">
          Create a Google Sheet with the following format:
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 border border-gray-300 text-left">word</th>
                <th className="p-2 border border-gray-300 text-left">severity</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-gray-300">free money</td>
                <td className="p-2 border border-gray-300">high</td>
              </tr>
              <tr>
                <td className="p-2 border border-gray-300">discount</td>
                <td className="p-2 border border-gray-300">low</td>
              </tr>
              <tr>
                <td className="p-2 border border-gray-300">limited offer</td>
                <td className="p-2 border border-gray-300">medium</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Make sure to:
        </p>
        <ul className="list-disc pl-5 mt-1 text-sm text-gray-600">
          <li>Include the exact column headers "word" and "severity"</li>
          <li>Set severity values to only "low", "medium", or "high"</li>
          <li>Share your sheet with "Anyone with the link" (View access)</li>
        </ul>
      </div>
    </div>
  );
};

export default SpamChecker;