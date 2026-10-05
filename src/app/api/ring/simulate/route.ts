import { NextRequest, NextResponse } from "next/server";
import { RingSimulatorProvider } from "@/ring/RingSimulatorProvider";
import { safeLog } from "@/ring/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, deviceId, eventType, summary } = body;

    const simulator = RingSimulatorProvider.getInstance();

    switch (action) {
      case "CONNECTED":
        simulator.setConnectionState(true);
        safeLog("info", "Simulator: Connection state set to CONNECTED");
        return NextResponse.json({ success: true, message: "Simulator connected" });

      case "DISCONNECTED":
        simulator.setConnectionState(false);
        safeLog("info", "Simulator: Connection state set to DISCONNECTED");
        return NextResponse.json({ success: true, message: "Simulator disconnected" });

      case "DEVICE_ONLINE":
        if (!deviceId) {
          return NextResponse.json({ success: false, message: "deviceId required" }, { status: 400 });
        }
        simulator.setDeviceOnlineState(deviceId, true);
        return NextResponse.json({ success: true, message: `Device ${deviceId} set to online` });

      case "DEVICE_OFFLINE":
        if (!deviceId) {
          return NextResponse.json({ success: false, message: "deviceId required" }, { status: 400 });
        }
        simulator.setDeviceOnlineState(deviceId, false);
        return NextResponse.json({ success: true, message: `Device ${deviceId} set to offline` });

      case "TRIGGER_EVENT":
      case "MOTION_EVENT":
      case "PACKAGE_EVENT": {
        const type =
          action === "MOTION_EVENT"
            ? "motion"
            : action === "PACKAGE_EVENT"
            ? "package_delivered"
            : eventType || "motion";

        const event = simulator.triggerEvent({
          eventType: type,
          deviceId,
          summary,
        });

        return NextResponse.json({
          success: true,
          message: `Triggered ${type} event`,
          event,
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: `Unknown simulator action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Simulator error" },
      { status: 500 }
    );
  }
}
