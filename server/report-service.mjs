import { getOverviewAnalytics } from './analytics-service.mjs';

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export async function buildOperationsReport(store) {
  const [analytics, workspace] = await Promise.all([
    getOverviewAnalytics(store),
    store.getWorkspace(),
  ]);

  const generatedAt = new Date().toISOString();
  const settings = workspace.settings;
  const activeMenuItems = workspace.menuItems.filter((item) => item.status === 'active');
  const specialOffers = workspace.menuItems.filter((item) => item.isSpecial);

  const lines = [
    'Bistro AI Operations Report',
    `Generated: ${generatedAt}`,
    `Restaurant: ${settings.brandName}`,
    `Voice profile: ${settings.activeVoice}`,
    `Routing number: ${settings.phoneRouting}`,
    '',
    'Summary',
    `Total calls handled: ${analytics.totalCallsHandled}`,
    `Successful calls: ${analytics.successfulCalls}`,
    `Success rate: ${analytics.successRate}%`,
    `Average duration: ${formatDuration(analytics.averageDurationSeconds)}`,
    `Active menu items: ${activeMenuItems.length}`,
    `Special offers: ${specialOffers.length}`,
    `Scripts available: ${analytics.scriptCount}`,
    `Reservations: ${analytics.reservationCount}`,
    `Pending reservations: ${analytics.pendingReservations}`,
    `Open orders: ${analytics.openOrders}`,
    `Order revenue: $${analytics.orderRevenue.toFixed(2)}`,
    '',
    '7-Day Volume Trend',
    ...analytics.volumeTrend7d.map((point) => `${point.day}: ${point.count} weighted calls (${point.val}% load)`),
    '',
    '30-Day Volume Trend',
    ...analytics.volumeTrend30d.map((point) => `${point.day}: ${point.count} weighted calls (${point.val}% load)`),
    '',
    'Special Offers',
    ...(specialOffers.length > 0
      ? specialOffers.map((item) => `${item.name} - $${item.price.toFixed(2)} - ${item.status}`)
      : ['No special offers configured.']),
    '',
    'Recent Activity',
    ...(workspace.activityLogs.length > 0
      ? workspace.activityLogs.map((log) => `${log.time} - ${log.title} - ${log.detail} - ${log.status} - ${log.duration}`)
      : ['No recent activity.']),
    '',
    'Script Library',
    ...(workspace.scripts.length > 0
      ? workspace.scripts.map((script) => `${script.title} - ${script.category} - ${script.lastUpdated}`)
      : ['No scripts configured.']),
    '',
    'Reservations',
    ...(workspace.reservations.length > 0
      ? workspace.reservations.map((reservation) => `${reservation.reservationDate} ${reservation.reservationTime} - ${reservation.customerName} - party of ${reservation.partySize} - ${reservation.status}`)
      : ['No reservations configured.']),
    '',
    'Orders',
    ...(workspace.orders.length > 0
      ? workspace.orders.map((order) => `${order.id} - ${order.customerName} - $${order.total.toFixed(2)} - ${order.status} - ${order.type}`)
      : ['No orders configured.']),
    '',
  ];

  return {
    filename: `bistro-ai-operations-report-${generatedAt.slice(0, 10)}.txt`,
    content: lines.join('\n'),
  };
}
