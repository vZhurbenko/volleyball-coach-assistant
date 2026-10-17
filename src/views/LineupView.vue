<script setup>
import { ref } from 'vue'

import LineupCourt from '../components/LineupCourt.vue'
import LineupPlayerDialog from '../components/LineupPlayerDialog.vue'
import { emptyLineup } from '../domain/lineup.js'
import { MOCK_ROSTER } from '../domain/players.js'

const roster = MOCK_ROSTER
const lineup = ref(emptyLineup())
const pickingZone = ref(null)

function assign({ playerId, role }) {
  lineup.value = {
    ...lineup.value,
    zones: { ...lineup.value.zones, [pickingZone.value]: { playerId, role } },
  }
  pickingZone.value = null
}
</script>

<template>
  <section class="screen">
    <h1>Расстановка</h1>
    <p>Нажмите на зону и выберите игрока. Роль можно переопределить при назначении.</p>
    <LineupCourt :lineup="lineup" :roster="roster" @select="pickingZone = $event" />
  </section>

  <LineupPlayerDialog
    v-if="pickingZone !== null"
    :zone="pickingZone"
    :players="roster"
    @assign="assign"
    @cancel="pickingZone = null"
  />
</template>
