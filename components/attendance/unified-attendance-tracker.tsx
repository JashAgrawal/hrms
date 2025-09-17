"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Clock,
  MapPin,
  Timer,
  CheckCircle,
  AlertTriangle,
  Building2,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { DailyTimeline } from "./daily-timeline";
import { AttendanceSummary } from "./attendance-summary";

interface AttendanceStatus {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  workHours?: number;
  status: string;
  method?: string;
  location?: any;
  locationValidation?: any;
}

interface Site {
  id: string | null;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
  siteType: string;
}

interface EmployeeSite {
  id: string;
  site: Site;
}

interface ActiveSiteVisit {
  id: string;
  checkInTime: string;
  purpose?: string;
  notes?: string;
  locationName?: string;
  site: Site | null;
}

interface Employee {
  id: string;
  employeeType: "NORMAL" | "FIELD_EMPLOYEE";
}

export function UnifiedAttendanceTracker() {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Field employee specific state
  const [assignedSites, setAssignedSites] = useState<EmployeeSite[]>([]);
  const [activeSiteVisits, setActiveSiteVisits] = useState<ActiveSiteVisit[]>(
    []
  );
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [checkingInToSite, setCheckingInToSite] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);

  useEffect(() => {
    fetchStatus();
    fetchEmployeeInfo();
  }, []); // Intentionally empty - these should run once on mount

  useEffect(() => {
    if (employee?.employeeType === "FIELD_EMPLOYEE") {
      fetchAssignedSites();
      fetchActiveSiteVisits();
    }
  }, [employee?.employeeType]); // Only depend on employeeType to avoid unnecessary re-renders

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/attendance/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeInfo = async () => {
    try {
      const response = await fetch("/api/employees/me");
      if (response.ok) {
        const data = await response.json();
        setEmployee(data);
      }
    } catch (error) {
      console.error("Error fetching employee info:", error);
    }
  };

  const fetchAssignedSites = async () => {
    try {
      const response = await fetch("/api/employees/me/sites");
      if (response.ok) {
        const data = await response.json();
        setAssignedSites(data.employeeSites || []);
      }
    } catch (error) {
      console.error("Error fetching assigned sites:", error);
    }
  };

  const fetchActiveSiteVisits = async () => {
    try {
      const response = await fetch("/api/site-visits/active");
      if (response.ok) {
        const data = await response.json();
        setActiveSiteVisits(data.siteVisits || []);
      }
    } catch (error) {
      console.error("Error fetching active site visits:", error);
    }
  };

  const getCurrentLocation = async () => {
    return new Promise<any>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          };
          setCurrentLocation(location);
          setLocationLoading(false);
          resolve(location);
        },
        (error) => {
          setLocationLoading(false);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        }
      );
    });
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    setLocationError(null);

    try {
      let location = null;

      // Try to get GPS location
      try {
        location = await getCurrentLocation();
        toast.success("Location acquired successfully");
      } catch (error) {
        console.log("GPS not available, proceeding with web check-in:", error);
        setLocationError(
          "GPS location not available. Using web-based check-in."
        );
      }

      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location,
          notes: "Unified attendance check-in",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresApproval) {
          toast.warning(
            data.message || "Check-in requires approval due to location"
          );
        } else {
          toast.success(data.message || "Successfully checked in");
        }
        await fetchStatus();
        // Refresh the page to update timeline and summary
        window.location.reload();
      } else {
        toast.error(data.error || "Failed to check in");
      }
    } catch (error) {
      toast.error("Failed to check in");
      console.error("Check-in error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);

    try {
      let location = null;

      // Try to get GPS location for checkout
      try {
        location = await getCurrentLocation();
      } catch (error) {
        console.log("GPS not available for checkout:", error);
      }

      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location,
          method: location ? "GPS" : "WEB",
          notes: "Unified attendance check-out",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Successfully checked out");
        await fetchStatus();
        // Refresh the page to update timeline and summary
        window.location.reload();
      } else {
        toast.error(data.error || "Failed to check out");
      }
    } catch (error) {
      toast.error("Failed to check out");
      console.error("Check-out error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleSiteCheckIn = async () => {
    if (useCurrentLocation && (!locationName || locationName.trim() === "")) {
      toast.error("Please provide a location name");
      return;
    }

    if (!useCurrentLocation && !selectedSite) {
      toast.error("Please select a site");
      return;
    }

    setCheckingInToSite(true);

    try {
      const location = await getCurrentLocation();

      if (useCurrentLocation) {
        // Check in at current location without site validation
        const response = await fetch("/api/site-visits/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locationName: locationName.trim(),
            checkInLocation: location,
            purpose,
            notes,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to check in at location");
        }

        const result = await response.json();
        toast.success(result.message || "Successfully checked in at location");
      } else {
        // Original assigned site logic
        const site = assignedSites.find(
          (es) => es.site.id === selectedSite
        )?.site;
        if (!site) {
          throw new Error("Selected site not found");
        }

        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          site.latitude!,
          site.longitude!
        );

        const isWithinRadius = distance <= site.radius!;

        if (!isWithinRadius) {
          toast.error(
            `You are ${Math.round(
              distance
            )}m away from the site (allowed: ${site.radius!}m). Please move closer to the site.`
          );
          setCheckingInToSite(false);
          return;
        }

        const response = await fetch("/api/site-visits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            siteId: selectedSite,
            checkInLocation: location,
            purpose,
            notes,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to check in to site");
        }

        const result = await response.json();
        toast.success(result.message || "Successfully checked in to site");
      }

      // Reset form
      setSelectedSite("");
      setPurpose("");
      setNotes("");
      setLocationName("");
      setSiteDialogOpen(false);
      fetchActiveSiteVisits();
      // Refresh the page to update timeline and summary
      window.location.reload();
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to check in"
      );
    } finally {
      setCheckingInToSite(false);
    }
  };

  const handleSiteCheckOut = async (visit: ActiveSiteVisit) => {
    try {
      const location = await getCurrentLocation();

      const response = await fetch(`/api/site-visits/${visit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkOutLocation: location,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to check out from site");
      }

      fetchActiveSiteVisits();
      toast.success("Successfully checked out from site");
      // Refresh the page to update timeline and summary
      window.location.reload();
    } catch (error) {
      console.error("Error checking out from site:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to check out from site"
      );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Attendance Summary */}
      <AttendanceSummary />

      {/* Daily Timeline */}
      {employee && (
        <DailyTimeline employeeType={employee.employeeType} />
      )}

      {/* Current Status */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge className={getStatusColor(status.status)}>
                {status.status.replace("_", " ")}
              </Badge>
            </div>

            {status.checkInTime && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Check In:</span>
                <span className="text-sm">
                  {new Date(status.checkInTime).toLocaleTimeString()}
                </span>
              </div>
            )}

            {status.checkOutTime && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Check Out:</span>
                <span className="text-sm">
                  {new Date(status.checkOutTime).toLocaleTimeString()}
                </span>
              </div>
            )}

            {status.workHours !== undefined &&
              status.workHours !== null &&
              typeof status.workHours === "number" && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Work Hours:</span>
                  <span className="text-sm">
                    {status.workHours.toFixed(2)}h
                  </span>
                </div>
              )}

            {status.method && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Method:</span>
                <Badge variant="outline">
                  {status.method === "GPS" ? (
                    <>
                      <Navigation className="h-3 w-3 mr-1" />
                      GPS Verified
                    </>
                  ) : (
                    <>
                      <Building2 className="h-3 w-3 mr-1" />
                      Web Based
                    </>
                  )}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location Status */}
      {currentLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Accuracy:</span>
                <span
                  className={`text-sm ${getAccuracyColor(
                    currentLocation.accuracy
                  )}`}
                >
                  ±{Math.round(currentLocation.accuracy)}m (
                  {getAccuracyText(currentLocation.accuracy)})
                </span>
              </div>
              {status?.locationValidation && (
                <Alert
                  className={
                    status.locationValidation.isValid
                      ? "border-green-200 bg-green-50"
                      : "border-yellow-200 bg-yellow-50"
                  }
                >
                  <div className="flex items-center gap-2">
                    {status.locationValidation.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    <AlertDescription
                      className={
                        status.locationValidation.isValid
                          ? "text-green-800"
                          : "text-yellow-800"
                      }
                    >
                      {status.locationValidation.isValid
                        ? "Location verified - within assigned work area"
                        : "Location outside assigned work areas"}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {locationError && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {locationError}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Attendance Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status?.hasCheckedIn ? (
            <Button
              onClick={handleCheckIn}
              disabled={actionLoading || locationLoading}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {actionLoading
                ? "Checking In..."
                : locationLoading
                ? "Getting Location..."
                : "Check In"}
            </Button>
          ) : !status?.hasCheckedOut ? (
            <div className="space-y-3">
              <Button
                onClick={handleCheckOut}
                disabled={actionLoading}
                size="lg"
                variant="destructive"
                className="w-full"
              >
                {actionLoading ? "Checking Out..." : "Check Out"}
              </Button>

              {/* Field Employee Options */}
              {employee?.employeeType === "FIELD_EMPLOYEE" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="h-4 w-4" />
                    <span>Field Employee Options</span>
                  </div>

                  <Dialog
                    open={siteDialogOpen}
                    onOpenChange={setSiteDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="lg" className="w-full">
                        <MapPin className="h-4 w-4 mr-2" />
                        Check In at Location
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Check In at Location</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Location Type Selection */}
                        <div className="space-y-3">
                          <label className="text-sm font-medium">
                            Location Type
                          </label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={
                                useCurrentLocation ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setUseCurrentLocation(true)}
                              className="flex-1"
                            >
                              Current Location
                            </Button>
                            <Button
                              type="button"
                              variant={
                                !useCurrentLocation ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setUseCurrentLocation(false)}
                              className="flex-1"
                              disabled={assignedSites.length === 0}
                            >
                              Assigned Site{" "}
                              {assignedSites.length === 0 && "(None)"}
                            </Button>
                          </div>
                        </div>

                        {useCurrentLocation ? (
                          <div>
                            <label className="text-sm font-medium">
                              Location Name *
                            </label>
                            <Input
                              type="text"
                              value={locationName}
                              onChange={(e) => setLocationName(e.target.value)}
                              placeholder="e.g., Client Office, Construction Site, etc."
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Provide a descriptive name for your current
                              location
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className="text-sm font-medium">
                              Select Assigned Site
                            </label>
                            <Select
                              value={selectedSite}
                              onValueChange={setSelectedSite}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a site" />
                              </SelectTrigger>
                              <SelectContent>
                                {assignedSites.map((employeeSite) => (
                                  <SelectItem
                                    key={employeeSite.site.id!}
                                    value={employeeSite.site.id!}
                                    disabled={activeSiteVisits.some(
                                      (v) => v.site?.id === employeeSite.site.id
                                    )}
                                  >
                                    <div>
                                      <div className="font-medium">
                                        {employeeSite.site.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {employeeSite.site.code}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-medium">
                            Purpose (Optional)
                          </label>
                          <Select value={purpose} onValueChange={setPurpose}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select purpose" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Client Meeting">
                                Client Meeting
                              </SelectItem>
                              <SelectItem value="Site Inspection">
                                Site Inspection
                              </SelectItem>
                              <SelectItem value="Delivery">Delivery</SelectItem>
                              <SelectItem value="Installation">
                                Installation
                              </SelectItem>
                              <SelectItem value="Maintenance">
                                Maintenance
                              </SelectItem>
                              <SelectItem value="Sales Visit">
                                Sales Visit
                              </SelectItem>
                              <SelectItem value="Training">Training</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium">
                            Notes (Optional)
                          </label>
                          <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any additional notes about your visit..."
                            rows={3}
                          />
                        </div>

                        <Button
                          onClick={handleSiteCheckIn}
                          disabled={
                            (useCurrentLocation && !locationName.trim()) ||
                            (!useCurrentLocation && !selectedSite) ||
                            checkingInToSite
                          }
                          className="w-full"
                        >
                          {checkingInToSite
                            ? "Checking In..."
                            : useCurrentLocation
                            ? "Check In at Location"
                            : "Check In to Site"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  Attendance completed for today
                </span>
              </div>
              <p className="text-sm text-gray-600">
                You have successfully completed your attendance for today
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Site Visits for Field Employees */}
      {employee?.employeeType === "FIELD_EMPLOYEE" &&
        activeSiteVisits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Active Site Visits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeSiteVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {visit.site?.name ||
                          visit.locationName ||
                          "Unknown Location"}
                      </div>
                      <div className="text-sm text-gray-600">
                        Checked in at{" "}
                        {new Date(visit.checkInTime).toLocaleTimeString()}
                      </div>
                      {visit.purpose && (
                        <div className="text-xs text-gray-500">
                          Purpose: {visit.purpose}
                        </div>
                      )}
                      {visit.site?.siteType === "LOCATION_BASED" && (
                        <div className="text-xs text-blue-600 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location-based visit
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleSiteCheckOut(visit)}
                      variant="outline"
                      size="sm"
                    >
                      Check Out
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "PRESENT":
      return "bg-green-100 text-green-800";
    case "LATE":
      return "bg-yellow-100 text-yellow-800";
    case "ABSENT":
      return "bg-red-100 text-red-800";
    case "HALF_DAY":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getAccuracyColor(accuracy: number) {
  if (accuracy <= 10) return "text-green-600";
  if (accuracy <= 50) return "text-yellow-600";
  return "text-red-600";
}

function getAccuracyText(accuracy: number) {
  if (accuracy <= 10) return "High";
  if (accuracy <= 50) return "Medium";
  return "Low";
}
