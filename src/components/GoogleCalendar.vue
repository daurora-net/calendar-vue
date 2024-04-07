<script setup lang="ts">
import { ref, watch, onBeforeMount, computed } from "vue";
import axios from "axios";
import FullCalendar from "@fullcalendar/vue3";
import dayGridPlugin from '@fullcalendar/daygrid';
import jaLocale from '@fullcalendar/core/locales/ja';

let calendarApi: any = null;

const eventsLoaded = ref(false);
let currentMonthStart = ref<Date | null>(null);
let currentMonthEnd = ref<Date | null>(null);

type CalendarEvent = {
  title: string;
  start: string;
  end: string;
};

function calculateAvailableHours(date: Date, events: CalendarEvent[]): number {
  const workingHoursStart = 10; // 10:00
  const workingHoursEnd = 18; // 18:00
  const totalWorkingHours = workingHoursEnd - workingHoursStart;

  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Sunday (0) or Saturday (6)
    return 0;
  }

  const dayEvents = events.filter(event =>
    new Date(event.start).toDateString() === date.toDateString()
  );

  let occupiedHours = 0;

  for (const event of dayEvents) {
    let eventStart = new Date(event.start);
    let eventEnd = new Date(event.end);

    // 10時より前のイベント終了時間か、18時以降のイベント開始時間ならスキップ
    if (eventEnd.getHours() <= workingHoursStart || eventStart.getHours() >= workingHoursEnd) {
      continue;
    }

    if (eventStart.getHours() < workingHoursStart) {
      eventStart.setHours(workingHoursStart);
      eventStart.setMinutes(0);
    }

    if (eventEnd.getHours() > workingHoursEnd) {
      eventEnd.setHours(workingHoursEnd);
      eventEnd.setMinutes(0);
    }

    occupiedHours += (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
  }

  // 以下の行で小数点以下を切り捨て
  return Math.floor(totalWorkingHours - occupiedHours);
}

const calendarOptions = ref<{
  plugins: typeof dayGridPlugin[];
  headerToolbar: {
    left: string;
    center: string;
    right: string;
  };
  events: CalendarEvent[];
  editable: boolean;
  selectable: boolean;
  selectMirror: boolean;
  dayMaxEvents: boolean;
  weekends: boolean;
  locale: typeof jaLocale;
  datesSet?: (info: any) => void;
  dayCellDidMount?: (info: any) => void;
  viewDidMount?: (args: any) => void;
}>({
  plugins: [dayGridPlugin],
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: ''
  },
  events: [],
  editable: false,
  selectable: false,
  selectMirror: false,
  dayMaxEvents: true,
  weekends: true,
  locale: jaLocale,

  datesSet: (info) => {
    // 現在の月の初日を取得
    const firstDayOfMonth = new Date(info.view.currentStart);
    firstDayOfMonth.setDate(1);

    // 現在の月の最後の日を取得
    const lastDayOfMonth = new Date(info.view.currentStart);
    lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
    lastDayOfMonth.setDate(0);
    lastDayOfMonth.setHours(23, 59, 59, 999);

    currentMonthStart.value = firstDayOfMonth;
    currentMonthEnd.value = lastDayOfMonth;

    if (calendarApi) {
      calendarApi.render();
    }
  },

  viewDidMount: (args) => {
    calendarApi = args.view.calendar;
  },

  // 以下にdayCellDidMountの処理を追加
  dayCellDidMount: (info) => {
    const availableHours = calculateAvailableHours(info.date, calendarOptions.value.events);

    // Don't display the label for weekends
    const dayOfWeek = info.date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return;

    const hoursLabel = document.createElement('span');
    hoursLabel.innerText = `${availableHours}`;
    hoursLabel.style.position = 'absolute';
    hoursLabel.style.bottom = '0';
    hoursLabel.style.right = '0';
    hoursLabel.style.color = '#ff7200';
    hoursLabel.style.fontWeight = 'bold';
    hoursLabel.style.height = '7vh';
    hoursLabel.style.lineHeight = '7vh';
    hoursLabel.style.width = '7vh';
    hoursLabel.style.background = 'rgb(255 246 163)';
    hoursLabel.style.textAlign = 'center';
    info.el.appendChild(hoursLabel);
  }
});

async function fetchEvents() {
  const API_KEY = "AIzaSyCTmep-i2F5v7-3Y4wNUZaKNu4Hz9Vjdx0";
  const CALENDAR_ID = "daurora.net@gmail.com";
  const url = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events?key=${API_KEY}`;
  const response = await axios.get(url);

  const events: CalendarEvent[] = [];
  for (const item of response.data.items) {
    let startDate = item.start.dateTime ? new Date(item.start.dateTime) : new Date(item.start.date);
    let endDate = item.end.dateTime ? new Date(item.end.dateTime) : new Date(item.end.date);

    // 10時から18時の範囲内のみをフィルタリング
    if ((startDate.getHours() >= 10 && startDate.getHours() < 18) ||
      (endDate.getHours() > 10 && endDate.getHours() <= 18)) {
      if (!item.summary) item.summary = '';
      events.push({
        title: item.summary,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });
    }
  }
  return events;
}

const totalAvailableHoursForMonth = computed(() => {
  if (!eventsLoaded.value || !currentMonthStart.value || !currentMonthEnd.value) return 0;

  const startDate = new Date(currentMonthStart.value);
  const endDate = new Date(currentMonthEnd.value);

  const monthEvents = calendarOptions.value.events.filter((event: CalendarEvent) => {
    const eventStart = new Date(event.start);
    return eventStart >= startDate && eventStart <= endDate;
  });

  let totalHours = 0;
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    totalHours += calculateAvailableHours(new Date(date), monthEvents);
  }
  return totalHours;
});

watch(() => calendarOptions.value.events, () => {
  if (calendarApi) {
    calendarApi.render();
  }
});

onBeforeMount(async () => {
  calendarOptions.value.events = await fetchEvents();
  eventsLoaded.value = true;
});
</script>

<template>
  <div v-if="eventsLoaded" class="calendar_container card flex justify-content-center">
    <div class="calendar_header">
      <img alt="Vue logo" class="logo" src="../assets/logo.svg" width="125" height="125" />
      <p class="month-total-hours">This month's<br>total available hours:</p>
      <p class="month-total-hours-for-month"> {{ totalAvailableHoursForMonth }}</p>
    </div>
    <div class="calendar_funncalendar">
      <div class="info">
        <p class="info_text"></p>：稼働可能時間
      </div>
      <FullCalendar :options="calendarOptions" />
    </div>
  </div>
</template>

<style scoped>
.logo {
  display: block;
  margin: 0 auto 2rem;
}

.calendar_container {
  width: 100%;
  display: flex;
}

.calendar_header {
  width: 20%;
  display: block;
  text-align: center;
  margin: 10% 5% 0 0;
}

.calendar_funncalendar {
  width: 80%;
  position: relative;
}

.info {
  position: absolute;
  top: 40px;
  right: 10px;
  display: flex;
  line-height: 1rem;
  align-items: center;
  color: #fafafa;
  font-weight: bold;
}

.info_text {
  width: 30px;
  height: 15px;
  background-color: rgb(255 246 163);
}

:deep(.fc .fc-scrollgrid-liquid) {
  height: 100%;
  background: #fafafa;
  border-radius: 10px;
}

:deep(.fc-theme-standard td) {
  border-right: none;
  border-bottom: none;
  position: relative;
}

:deep(.fc-theme-standard th) {
  border-right: none;
  background-color: #eee;
  border-radius: 10px 10px 0 0;
}

:deep(.fc .fc-toolbar-title) {
  margin: 0 0 0 -50%;
  font-weight: bold;
}

:deep(.fc .fc-toolbar.fc-header-toolbar) {
  margin-bottom: 0.5em;
  color: #fafafa;
  font-weight: bold;
}

:deep(.fc-direction-ltr) {
  height: 100vh;
  padding: 1rem 0;
}

.month-total-hours {
  font-size: 18px;
  margin-top: 10px;
  color: #fafafa;
  font-weight: bold;
}

.month-total-hours-for-month {
  font-size: 22px;
  color: #fff6a3;
  font-weight: 700;
  border: 1px solid rgb(255 246 163);
  border-radius: 10px;
  width: 55%;
  margin: 15px auto;
  height: 3rem;
  line-height: 2.9rem;
}

:deep(.fc-day-other span) {
  opacity: .3;
}

:deep(.fc-day-other .fc-daygrid-day-events) {
  opacity: .3;
}

:deep(.fc .fc-daygrid-day.fc-day-today) {
  background-color: rgb(0 193 255 / 14%);
}

@media (max-width: 730px) {
  .logo {
    width: 30%;
    height: 30%;
    margin: 0 auto 1rem;
  }

  .calendar_container {
    display: block;
  }

  .calendar_header {
    width: 100%;
    margin: 10% auto 0;
  }

  .calendar_funncalendar {
    width: 100%;
    margin: 10% 0 0;
  }

  :deep(.fc .fc-toolbar-title) {
    margin: 0;
    font-size: 6vw;
  }

  :deep(.fc .fc-toolbar.fc-header-toolbar) {
    margin-bottom: 2em;
  }

  .info {
    top: 66px;
  }

  :deep(.fc-daygrid-day-events) {
    display: none;
  }
}
</style>