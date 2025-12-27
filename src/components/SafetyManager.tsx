import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ban, Flag, Users, AlertTriangle, Shield, Loader2, Search, Trash2 } from "lucide-react";

interface BlockedUser {
  id: string;
  blocked_id: string;
  blocked_at: string;
  reason: string | null;
  profile?: {
    name: string;
    email: string;
    photo_urls?: string[];
  };
}

interface UserReport {
  id: string;
  reported_user_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface SearchResult {
  id: string;
  name: string;
  email: string;
  photo_urls?: string[];
}

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or scam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

export const SafetyManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [myReports, setMyReports] = useState<UserReport[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Block user dialog state
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [selectedUserToBlock, setSelectedUserToBlock] = useState<SearchResult | null>(null);
  const [blocking, setBlocking] = useState(false);
  
  // Report user dialog state
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportSearchResults, setReportSearchResults] = useState<SearchResult[]>([]);
  const [reportSearching, setReportSearching] = useState(false);
  const [selectedUserToReport, setSelectedUserToReport] = useState<SearchResult | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      // Fetch blocked users
      const { data: blocked, error: blockedError } = await supabase
        .from("blocked_users")
        .select("*")
        .eq("blocker_id", user.id)
        .order("blocked_at", { ascending: false });

      if (blockedError) throw blockedError;

      // Fetch profiles for blocked users
      if (blocked && blocked.length > 0) {
        const blockedIds = blocked.map(b => b.blocked_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email, photo_urls")
          .in("id", blockedIds);

        const blockedWithProfiles = blocked.map(b => ({
          ...b,
          profile: profiles?.find(p => p.id === b.blocked_id)
        }));
        setBlockedUsers(blockedWithProfiles);
      } else {
        setBlockedUsers([]);
      }

      // Fetch user's reports
      const { data: reports, error: reportsError } = await supabase
        .from("user_reports")
        .select("*")
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false });

      if (reportsError) throw reportsError;
      setMyReports(reports || []);

    } catch (error: any) {
      console.error("Error fetching safety data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load safety data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string, isForReport = false) => {
    if (query.length < 2) {
      if (isForReport) {
        setReportSearchResults([]);
      } else {
        setSearchResults([]);
      }
      return;
    }

    if (isForReport) {
      setReportSearching(true);
    } else {
      setSearching(true);
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, photo_urls")
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .neq("id", currentUserId)
        .limit(10);

      if (error) throw error;

      // Filter out already blocked users for block search
      const results = data || [];
      if (isForReport) {
        setReportSearchResults(results);
      } else {
        const blockedIds = blockedUsers.map(b => b.blocked_id);
        setSearchResults(results.filter(r => !blockedIds.includes(r.id)));
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      if (isForReport) {
        setReportSearching(false);
      } else {
        setSearching(false);
      }
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUserToBlock || !currentUserId) return;

    setBlocking(true);
    try {
      const { error } = await supabase
        .from("blocked_users")
        .insert({
          blocker_id: currentUserId,
          blocked_id: selectedUserToBlock.id,
          reason: blockReason || null,
        });

      if (error) throw error;

      toast({
        title: "User blocked",
        description: `${selectedUserToBlock.name} has been blocked. They can no longer message you.`,
      });

      setShowBlockDialog(false);
      setSelectedUserToBlock(null);
      setBlockReason("");
      setSearchQuery("");
      setSearchResults([]);
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to block user",
        description: error.message,
      });
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblockUser = async (blockedUserId: string, userName: string) => {
    try {
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", currentUserId)
        .eq("blocked_id", blockedUserId);

      if (error) throw error;

      toast({
        title: "User unblocked",
        description: `${userName} has been unblocked.`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to unblock user",
        description: error.message,
      });
    }
  };

  const handleReportUser = async () => {
    if (!selectedUserToReport || !currentUserId || !reportReason) return;

    setReporting(true);
    try {
      const { error } = await supabase
        .from("user_reports")
        .insert({
          reporter_id: currentUserId,
          reported_user_id: selectedUserToReport.id,
          reason: reportReason,
          description: reportDescription || null,
        });

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: "Your report has been submitted and will be reviewed by administrators.",
      });

      setShowReportDialog(false);
      setSelectedUserToReport(null);
      setReportReason("");
      setReportDescription("");
      setReportSearchQuery("");
      setReportSearchResults([]);
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to submit report",
        description: error.message,
      });
    } finally {
      setReporting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
      case "reviewed": return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
      case "resolved": return "bg-green-500/20 text-green-600 dark:text-green-400";
      case "dismissed": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Safety Features Card */}
      <Card className="bg-green-500/5 border-green-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-600 dark:text-green-400">
            <Shield className="h-5 w-5" />
            User Safety Features
          </CardTitle>
          <CardDescription>
            Your safety is important to us. Here's how you can protect yourself:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Ban className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-sm">Block Users</h4>
                <p className="text-xs text-muted-foreground">
                  Block users who are harassing you. Blocked users cannot send you messages.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Flag className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-sm">Report Users</h4>
                <p className="text-xs text-muted-foreground">
                  Report inappropriate behavior. Reports are reviewed by administrators.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-sm">Moderated Community</h4>
                <p className="text-xs text-muted-foreground">
                  Administrators review reports and can remove users who violate guidelines.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-sm">Closed Community</h4>
                <p className="text-xs text-muted-foreground">
                  Users must be invited to join your group, reducing abuse risk.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
            {/* Block User Button */}
            <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Ban className="h-4 w-4" />
                  Block a User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Block a User</DialogTitle>
                  <DialogDescription>
                    Search for a user to block. Blocked users cannot send you messages.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Search by name or email</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Type to search..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchUsers(e.target.value);
                        }}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {searching && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}

                  {searchResults.length > 0 && !selectedUserToBlock && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUserToBlock(user)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {user.photo_urls?.[0] ? (
                              <img src={user.photo_urls[0]} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              user.name?.charAt(0).toUpperCase() || "?"
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedUserToBlock && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {selectedUserToBlock.photo_urls?.[0] ? (
                            <img src={selectedUserToBlock.photo_urls[0]} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            selectedUserToBlock.name?.charAt(0).toUpperCase() || "?"
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{selectedUserToBlock.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedUserToBlock.email}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUserToBlock(null)}
                        >
                          Change
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Input
                          placeholder="Why are you blocking this user?"
                          value={blockReason}
                          onChange={(e) => setBlockReason(e.target.value)}
                        />
                      </div>

                      <Button
                        onClick={handleBlockUser}
                        disabled={blocking}
                        className="w-full"
                        variant="destructive"
                      >
                        {blocking ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Blocking...
                          </>
                        ) : (
                          <>
                            <Ban className="h-4 w-4 mr-2" />
                            Block User
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Report User Button */}
            <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Flag className="h-4 w-4" />
                  Report a User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report a User</DialogTitle>
                  <DialogDescription>
                    Submit a report for inappropriate behavior. Our team will review it.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {!selectedUserToReport ? (
                    <>
                      <div className="space-y-2">
                        <Label>Search by name or email</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Type to search..."
                            value={reportSearchQuery}
                            onChange={(e) => {
                              setReportSearchQuery(e.target.value);
                              searchUsers(e.target.value, true);
                            }}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      {reportSearching && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      )}

                      {reportSearchResults.length > 0 && (
                        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                          {reportSearchResults.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => setSelectedUserToReport(user)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                {user.photo_urls?.[0] ? (
                                  <img src={user.photo_urls[0]} alt="" className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  user.name?.charAt(0).toUpperCase() || "?"
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {selectedUserToReport.photo_urls?.[0] ? (
                            <img src={selectedUserToReport.photo_urls[0]} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            selectedUserToReport.name?.charAt(0).toUpperCase() || "?"
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{selectedUserToReport.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedUserToReport.email}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUserToReport(null)}
                        >
                          Change
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Reason for report *</Label>
                        <Select value={reportReason} onValueChange={setReportReason}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a reason..." />
                          </SelectTrigger>
                          <SelectContent>
                            {REPORT_REASONS.map((reason) => (
                              <SelectItem key={reason.value} value={reason.value}>
                                {reason.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Additional details (optional)</Label>
                        <Textarea
                          placeholder="Please provide more details about the incident..."
                          value={reportDescription}
                          onChange={(e) => setReportDescription(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <Button
                        onClick={handleReportUser}
                        disabled={reporting || !reportReason}
                        className="w-full"
                      >
                        {reporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Flag className="h-4 w-4 mr-2" />
                            Submit Report
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Blocked Users Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-5 w-5" />
            Blocked Users ({blockedUsers.length})
          </CardTitle>
          <CardDescription>
            Manage users you've blocked. Blocked users cannot send you messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blockedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ban className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">You haven't blocked anyone.</p>
              <p className="text-xs mt-1">Use the "Block a User" button above to block someone.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((blocked) => (
                <div
                  key={blocked.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {blocked.profile?.photo_urls?.[0] ? (
                        <img src={blocked.profile.photo_urls[0]} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        blocked.profile?.name?.charAt(0).toUpperCase() || "?"
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{blocked.profile?.name || "Unknown User"}</p>
                      <p className="text-xs text-muted-foreground">
                        Blocked {new Date(blocked.blocked_at).toLocaleDateString()}
                        {blocked.reason && ` • ${blocked.reason}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnblockUser(blocked.blocked_id, blocked.profile?.name || "User")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Reports Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flag className="h-5 w-5" />
            My Reports ({myReports.length})
          </CardTitle>
          <CardDescription>
            View the status of reports you've submitted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">You haven't submitted any reports.</p>
              <p className="text-xs mt-1">Use the "Report a User" button above if needed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {REPORT_REASONS.find(r => r.value === report.reason)?.label || report.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(report.created_at).toLocaleDateString()}
                    </p>
                    {report.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {report.description}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getStatusBadgeColor(report.status)}`}>
                    {report.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
