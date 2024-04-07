import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from 'primevue/config'; // PrimeVueをインポート

const app = createApp(App);

// PrimeVue プラグインの追加
app.use(PrimeVue);

app.mount('#app');
