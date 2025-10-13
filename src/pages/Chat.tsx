import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const Chat = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-4xl mx-auto p-4">
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Messages
            </CardTitle>
            <CardDescription>Chat with bands and managers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet. Start connecting with bands and managers!</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default Chat;
