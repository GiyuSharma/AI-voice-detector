let realtimeChart;

// Draw speedometer scale marks on load
window.addEventListener('DOMContentLoaded', function() {
  const scaleMarks = document.getElementById('scaleMarks');
  if (scaleMarks) {
    const centerX = 150;
    const centerY = 150;
    const radius = 125;
    
    // Create complete circle marks (0-100 mapped to 360 degrees)
    // 200 marks for ultra-smooth appearance
    for (let i = 0; i <= 200; i++) {
      // Map 0-100 range to 180° to 540° (full circle starting from bottom)
      const value = (i / 200) * 100;
      const angle = 180 + (i * 1.8); // 360 degrees total
      const angleRad = (angle * Math.PI) / 180;
      
      // Major marks every 5 units (every 10 steps), minor marks more frequently
      const isMajorMark = i % 10 === 0;
      const length = isMajorMark ? 18 : 8;
      const width = isMajorMark ? 3.5 : 1.8;
      
      const x1 = centerX + (radius - length) * Math.cos(angleRad);
      const y1 = centerY + (radius - length) * Math.sin(angleRad);
      const x2 = centerX + radius * Math.cos(angleRad);
      const y2 = centerY + radius * Math.sin(angleRad);
      
      // Color coding based on value
      let color = '#4facfe'; // Blue for 0-30
      if (value > 80) color = '#ef4444'; // Red for 80-100
      else if (value > 60) color = '#f59e0b'; // Orange for 60-80
      else if (value > 30) color = '#10b981'; // Green for 30-60
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', width);
      line.setAttribute('stroke-linecap', 'round');
      
      scaleMarks.appendChild(line);
    }
  }
});

document.getElementById("uploadForm").addEventListener("submit", async e => {
  e.preventDefault();

  const file = document.getElementById("audioInput").files[0];
  const data = new FormData();
  data.append("audio", file);

  // Show loading state
  const btn = e.target.querySelector('button');
  const originalContent = btn.innerHTML;
  btn.innerHTML = '<span>Analyzing...</span>';
  btn.disabled = true;

  try {
    const res = await fetch("/predict", {
      method: "POST",
      body: data
    });
    const out = await res.json();

    document.getElementById("result").classList.remove("hidden");
    document.getElementById("result").scrollIntoView({ behavior: 'smooth' });

    // Animate the score
    animateValue("fakeText", 0, out.fake_percentage, 1500);
    
    // Animate speedometer value
    animateValue("speedValue", 0, out.fake_percentage, 1500);

    document.getElementById("summary").innerText = out.summary;

    document.getElementById("spectrogram").src = out.spectrogram + "?t=" + Date.now();
    document.getElementById("timeline").src = out.timeline + "?t=" + Date.now();
    document.getElementById("heatmap").src = out.heatmap + "?t=" + Date.now();

    document.getElementById("reportLink").href = out.report;

    // Animate speedometer needle (0-100 clockwise, 270 degree range)
    // 0% = 180° (bottom), 100% = 450° (270° clockwise = right side)
    const rotation = 180 + (out.fake_percentage * 2.7); // 270 degrees for 0-100%
    const needleGroup = document.getElementById("needleGroup");
    needleGroup.style.transformOrigin = '150px 150px';
    needleGroup.style.transform = `rotate(${rotation}deg)`;
    
    // Also update speedometer value display
    setTimeout(() => {
      document.getElementById('speedValue').textContent = Math.round(out.fake_percentage);
    }, 1000);

    // Update table with status badges
    const tbody = document.querySelector("#frameTable tbody");
    tbody.innerHTML = "";
    out.frame_table.forEach(r => {
      const status = r.fake_probability < 30 ? 'low' : 
                     r.fake_probability < 60 ? 'medium' : 'high';
      const statusText = r.fake_probability < 30 ? 'Authentic' : 
                        r.fake_probability < 60 ? 'Suspicious' : 'Likely Fake';
      
      tbody.innerHTML += `
        <tr>
          <td>${r.frame}</td>
          <td>${r.fake_probability}%</td>
          <td><span class="status-badge status-${status}">${statusText}</span></td>
        </tr>
      `;
    });

    startRealtimeGraph(out.realtime_series);
  } catch (error) {
    alert('Error analyzing audio: ' + error.message);
  } finally {
    btn.innerHTML = originalContent;
    btn.disabled = false;
  }
});

// Animate number counting
function animateValue(id, start, end, duration) {
  const element = document.getElementById(id);
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = Math.round(current * 100) / 100;
  }, 16);
}

// File input label update
document.getElementById("audioInput").addEventListener("change", function(e) {
  const fileName = e.target.files[0]?.name;
  if (fileName) {
    const fileText = document.getElementById("fileStatusText");
    const fileSubtext = document.querySelector(".file-subtext");
    const label = document.querySelector(".file-label");
    
    label.classList.add("file-selected");
    fileText.textContent = "File Selected ✓";
    fileSubtext.textContent = fileName;
  }
});

function startRealtimeGraph(series) {
  const ctx = document.getElementById("realtimeChart").getContext("2d");
  if (realtimeChart) realtimeChart.destroy();

  realtimeChart = new Chart(ctx, {
    type: "line",
    data: { 
      labels: [], 
      datasets: [{ 
        label: "Deepfake Probability (%)", 
        data: [],
        borderColor: "#667eea",
        backgroundColor: "rgba(102, 126, 234, 0.1)",
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#667eea",
        pointBorderColor: "#fff",
        pointBorderWidth: 2
      }] 
    },
    options: { 
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 300
      },
      scales: { 
        y: { 
          min: 0, 
          max: 100,
          grid: {
            color: "rgba(255, 255, 255, 0.1)"
          },
          ticks: {
            color: "#cbd5e1"
          }
        },
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.05)"
          },
          ticks: {
            color: "#cbd5e1"
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#cbd5e1",
            font: {
              size: 14
            }
          }
        }
      }
    }
  });

  let i = 0;
  const interval = setInterval(() => {
    if (i >= series.length) return clearInterval(interval);
    realtimeChart.data.labels.push(`T${i + 1}`);
    realtimeChart.data.datasets[0].data.push(series[i]);
    realtimeChart.update();
    i++;
  }, 300);
}
