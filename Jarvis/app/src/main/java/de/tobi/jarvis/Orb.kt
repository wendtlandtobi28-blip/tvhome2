package de.tobi.jarvis

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

enum class Mood { Idle, Listening, Thinking, Speaking, Sleeping }

val Pink = Color(0xFFFF3D9A)
val PinkSoft = Color(0xFFFF8CC6)
val Bg = Color(0xFF0B0710)

private class Shell(val count: Int, val radius: Float, val tiltX: Float, val tiltY: Float, val speed: Float) {
    val pts: List<FloatArray> = List(count) {
        val u = Random.nextFloat() * 2f - 1f
        val t = Random.nextFloat() * 2f * PI.toFloat()
        val k = sqrt(1f - u * u)
        floatArrayOf(k * cos(t), k * sin(t), u)
    }
}

private class Ring(val r: Float, val width: Float, val segs: Int, val len: Float, val dir: Float, val speed: Float)

/**
 * Der pinke Kern: Lichtpunkte auf drei Kugelschalen, die sich um verschiedene Achsen
 * in verschiedene Richtungen drehen, fließende Schlieren im Inneren und Ringe außen herum.
 */
@Composable
fun Orb(mood: Mood, level: Float, modifier: Modifier = Modifier) {
    val shells = remember {
        listOf(
            Shell(150, 0.30f, 0.6f, 0.2f, 0.35f),
            Shell(120, 0.24f, -0.9f, 1.1f, -0.55f),
            Shell(90, 0.17f, 1.4f, -0.6f, 0.8f),
        )
    }
    val rings = remember {
        listOf(
            Ring(0.37f, 2f, 3, 0.55f, 1f, 1f),
            Ring(0.41f, 1f, 24, 0.12f, -1f, 0.6f),
            Ring(0.45f, 3f, 2, 0.9f, 1f, 0.35f),
            Ring(0.48f, 1f, 60, 0.04f, -1f, 0.2f),
        )
    }
    val currentMood by rememberUpdatedState(mood)
    val currentLevel by rememberUpdatedState(level)
    var time by remember { mutableFloatStateOf(0f) }
    var energy by remember { mutableFloatStateOf(0.3f) }
    var spin by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(Unit) {
        var last = 0L
        while (true) {
            withFrameNanos { now ->
                val dt = if (last == 0L) 0.016f else ((now - last) / 1e9f).coerceAtMost(0.05f)
                last = now
                time += dt
                val t = time
                val target = when (currentMood) {
                    Mood.Sleeping -> 0.12f
                    Mood.Idle -> 0.3f
                    Mood.Listening -> 0.45f + 0.5f * currentLevel
                    Mood.Thinking -> 0.85f
                    Mood.Speaking -> 0.55f + 0.35f * abs(sin(t * 9f) * sin(t * 3.3f))
                }
                energy += (target - energy) * 0.08f
                spin += (0.25f + energy * 1.2f) * dt
            }
        }
    }

    Canvas(modifier) {
        val w = minOf(size.width, size.height)
        val c = Offset(size.width / 2f, size.height / 2f)
        val e = energy
        val t = time

        // äußeres Leuchten
        drawCircle(
            Brush.radialGradient(
                0f to Pink.copy(alpha = 0.35f + e * 0.3f),
                0.45f to Pink.copy(alpha = 0.12f + e * 0.12f),
                1f to Color.Transparent,
                center = c, radius = w * 0.5f
            ),
            radius = w * 0.5f, center = c
        )

        val r = w * (0.31f + e * 0.02f)
        val core = Path().apply { addOval(androidx.compose.ui.geometry.Rect(c, r)) }
        clipPath(core) {
            drawRect(Color(0xE6280618), topLeft = Offset(c.x - r, c.y - r), size = Size(r * 2, r * 2))
            // Schlieren, die gegeneinander durch den Kern fließen
            for (i in 0 until 5) {
                val ph = i * 1.7f
                val dir = if (i % 2 == 0) 1f else -1f
                val a = ph + t * (0.25f + i * 0.09f) * dir * (1f + e * 2f)
                val p = Offset(c.x + cos(a) * r * 0.45f, c.y + sin(a * 1.3f) * r * 0.45f)
                val br = r * (0.55f + 0.15f * sin(t + ph))
                drawCircle(
                    Brush.radialGradient(
                        0f to Color(0xFFFF78BE).copy(alpha = 0.35f + e * 0.25f),
                        1f to Color.Transparent, center = p, radius = br
                    ),
                    radius = br, center = p, blendMode = BlendMode.Plus
                )
            }
            // Lichtpunkte auf gekippten, gegenläufig rotierenden Kugelschalen
            for (s in shells) {
                val ang = spin * s.speed * 1.5f
                val ca = cos(ang); val sa = sin(ang)
                val cx = cos(s.tiltX); val sx = sin(s.tiltX)
                val cy = cos(s.tiltY); val sy = sin(s.tiltY)
                val rr = w * s.radius * (1f + e * 0.12f)
                for (pt in s.pts) {
                    val x = pt[0] * ca - pt[1] * sa
                    val y = pt[0] * sa + pt[1] * ca
                    val z = pt[2]
                    val y2 = y * cx - z * sx
                    val z2 = y * sx + z * cx
                    val x3 = x * cy + z2 * sy
                    val z3 = -x * sy + z2 * cy
                    val depth = (z3 + 1f) / 2f
                    drawCircle(
                        Color(1f, (170f + depth * 80f) / 255f, (220f + depth * 35f) / 255f, 0.15f + depth * 0.75f),
                        radius = (0.6f + depth * 1.8f) * density * 0.8f,
                        center = Offset(c.x + x3 * rr, c.y + y2 * rr)
                    )
                }
            }
        }

        drawCircle(PinkSoft.copy(alpha = 0.6f + e * 0.4f), radius = r, center = c, style = Stroke(1.5f * density))

        // Ringe, die sich gegeneinander drehen
        for (ring in rings) {
            val base = spin * ring.speed * ring.dir * 40f
            val step = 360f / ring.segs
            val rad = w * ring.r
            for (i in 0 until ring.segs) {
                drawArc(
                    Pink.copy(alpha = 0.35f + e * 0.5f),
                    startAngle = base + i * step, sweepAngle = step * ring.len, useCenter = false,
                    topLeft = Offset(c.x - rad, c.y - rad), size = Size(rad * 2, rad * 2),
                    style = Stroke(ring.width * density)
                )
            }
        }
    }
}
