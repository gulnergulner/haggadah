// 기존 haggadah.html의 축하 효과 재현: 불꽃놀이 / 배경 플래시 / 풍선

export function triggerFirework() {
  const firework = document.createElement('div')
  firework.classList.add('firework')
  firework.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`
  document.body.appendChild(firework)
  setTimeout(() => firework.remove(), 1000)
}

export function flashBackground() {
  document.body.classList.add('background-flash')
  setTimeout(() => document.body.classList.remove('background-flash'), 3000)
}

export function releaseBalloons() {
  const colors = ['red', 'blue', 'green', 'yellow', 'purple']
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const balloon = document.createElement('div')
      balloon.classList.add('balloon')
      balloon.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      balloon.style.left = `${Math.random() * 100}vw`
      document.body.appendChild(balloon)
      setTimeout(() => balloon.remove(), 5000)
    }, i * 300)
  }
}
