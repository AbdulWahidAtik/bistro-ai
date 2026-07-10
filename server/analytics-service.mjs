const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function durationToSeconds(duration) {
  const [minutes = '0', seconds = '0'] = String(duration || '0:00').split(':');
  return Number(minutes) * 60 + Number(seconds);
}

function buildTrend(logs, days) {
  const bucketCount = days === 30 ? 10 : 7;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    day: dayLabels[index % dayLabels.length],
    count: 0,
    val: 8,
  }));

  logs.forEach((log, index) => {
    const bucketIndex = index % bucketCount;
    const typeWeight = log.type === 'reservation' || log.type === 'takeout' ? 2 : 1;
    buckets[bucketIndex].count += typeWeight;
  });

  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return buckets.map((bucket) => ({
    ...bucket,
    count: bucket.count,
    val: Math.max(8, Math.round((bucket.count / maxCount) * 95)),
  }));
}

export async function getOverviewAnalytics(store) {
  const [logs, menuItems, scripts, reservations, orders] = await Promise.all([
    store.listActivityLogs(),
    store.listMenuItems(),
    store.listScripts(),
    store.listReservations(),
    store.listOrders(),
  ]);

  const successfulCalls = logs.filter((log) => log.status === 'SUCCESS').length;
  const totalDuration = logs.reduce((sum, log) => sum + durationToSeconds(log.duration), 0);

  return {
    totalCallsHandled: logs.length,
    successfulCalls,
    successRate: logs.length > 0 ? Math.round((successfulCalls / logs.length) * 100) : 0,
    activeOffers: menuItems.filter((item) => item.isSpecial && item.status === 'active').length,
    inactiveSpecials: menuItems.filter((item) => item.isSpecial && item.status === 'inactive').length,
    scriptCount: scripts.length,
    reservationCount: reservations.length,
    pendingReservations: reservations.filter((reservation) => reservation.status === 'pending').length,
    openOrders: orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length,
    orderRevenue: orders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
    averageDurationSeconds: logs.length > 0 ? Math.round(totalDuration / logs.length) : 0,
    volumeTrend7d: buildTrend(logs, 7),
    volumeTrend30d: buildTrend(logs, 30),
  };
}
