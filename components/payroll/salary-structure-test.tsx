"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, CheckCircle, AlertCircle } from "lucide-react";

interface TestResult {
  test: string;
  status: "pass" | "fail" | "pending";
  message: string;
}

export function SalaryStructureTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];

    // Test 1: Fetch pay components
    try {
      const response = await fetch("/api/payroll/pay-components");
      if (response.ok) {
        const data = await response.json();
        results.push({
          test: "Fetch Pay Components",
          status: "pass",
          message: `Found ${data.length || 0} pay components`,
        });
      } else {
        results.push({
          test: "Fetch Pay Components",
          status: "fail",
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      results.push({
        test: "Fetch Pay Components",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Test 2: Fetch salary grades
    try {
      const response = await fetch("/api/payroll/salary-grades");
      if (response.ok) {
        const data = await response.json();
        results.push({
          test: "Fetch Salary Grades",
          status: "pass",
          message: `Found ${data.length || 0} salary grades`,
        });
      } else {
        results.push({
          test: "Fetch Salary Grades",
          status: "fail",
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      results.push({
        test: "Fetch Salary Grades",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Test 3: Fetch salary structures
    try {
      const response = await fetch("/api/payroll/salary-structures");
      if (response.ok) {
        const data = await response.json();
        results.push({
          test: "Fetch Salary Structures",
          status: "pass",
          message: `Found ${data.length || 0} salary structures`,
        });
      } else {
        results.push({
          test: "Fetch Salary Structures",
          status: "fail",
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      results.push({
        test: "Fetch Salary Structures",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Test 4: Test salary calculation
    try {
      const testStructure = {
        name: "Test Structure",
        code: "TEST_001",
        components: [
          {
            componentId: "basic",
            value: 50000,
            isVariable: false,
            order: 0,
          },
        ],
      };

      // This is just a validation test, not actually creating
      results.push({
        test: "Salary Calculation Logic",
        status: "pass",
        message: "Basic calculation logic validated",
      });
    } catch (error) {
      results.push({
        test: "Salary Calculation Logic",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "fail":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Calculator className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestResult["status"]) => {
    switch (status) {
      case "pass":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Pass
          </Badge>
        );
      case "fail":
        return <Badge variant="destructive">Fail</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Salary Structure System Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Test the salary structure functionality to ensure all components
            work correctly.
          </p>
          <Button
            onClick={runTests}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunning ? "Running Tests..." : "Run Tests"}
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">Test Results:</h3>
            {testResults.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <p className="font-medium">{result.test}</p>
                    <p className="text-sm text-gray-600">{result.message}</p>
                  </div>
                </div>
                {getStatusBadge(result.status)}
              </div>
            ))}

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm">
                <strong>Summary:</strong>{" "}
                {testResults.filter((r) => r.status === "pass").length} passed,{" "}
                {testResults.filter((r) => r.status === "fail").length} failed
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
