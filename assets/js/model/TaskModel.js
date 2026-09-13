/**
 * CAPA MODEL — TaskModel.js
 * Consumo de la API Node/Express.
 * Endpoints: api/tareas | api/materias
 * Fallback: localStorage cuando no hay conexión.
 */

class TaskModel {

    constructor() {
        this.API_TAREAS   = 'api/tareas';
        this.API_MATERIAS = 'api/materias';
        this._tareas = [];
    }

    // ── Fallback localStorage ─────────────────────────────────────────────────
    _lsGet()        { return JSON.parse(localStorage.getItem('tm_tareas') || '[]'); }
    _lsSave(tareas) { localStorage.setItem('tm_tareas', JSON.stringify(tareas)); }
    _lsNextId() {
        const t = this._lsGet();
        return t.length ? Math.max(...t.map(x => x.id)) + 1 : 1;
    }

    // ── Usuario en sesión (para asociar y filtrar tareas) ─────────────────────
    _userId() {
        try {
            const u = JSON.parse(localStorage.getItem('tm_user') || 'null');
            return u && u.id ? u.id : null;
        } catch (e) {
            return null;
        }
    }

    // ── GET: todas las tareas ─────────────────────────────────────────────────
    async getAll() {
        const uid = this._userId();
        if (!uid) {
            this._tareas = this._lsGet();
            return this._tareas;
        }
        try {
            const res  = await fetch(this.API_TAREAS, { credentials: 'include' });
            const data = await res.json();
            if (res.ok && data.success) {
                this._tareas = data.tareas;
                this._lsSave(this._tareas); // sincronizar localStorage
                return this._tareas;
            }
            if (res.status === 401) {
                console.warn('No autorizado al obtener tareas. Usando localStorage.');
            }
        } catch (e) {
            console.warn('API no disponible — usando localStorage', e);
        }
        this._tareas = this._lsGet();
        return this._tareas;
    }

    // ── POST: crear tarea ─────────────────────────────────────────────────────
    async create(tarea) {
        if (!tarea.titulo || tarea.titulo.trim() === '') {
            return { success: false, error: 'El título es obligatorio.' };
        }
        if (!tarea.fecha_limite) {
            return { success: false, error: 'La fecha límite es obligatoria.' };
        }
        if (!this._userId()) {
            const nueva = { ...tarea, usuario_id: null, id: this._lsNextId(), completada: 0, pomodoros_real: 0 };
            const arr = this._lsGet();
            arr.push(nueva);
            this._lsSave(arr);
            this._tareas = arr;
            return { success: true, tarea: nueva };
        }
        try {
            const res  = await fetch(this.API_TAREAS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(tarea)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                this._tareas.push(data.tarea);
                this._lsSave(this._tareas);
                return { success: true, tarea: data.tarea };
            }
            if (res.status === 401) {
                console.warn('No autorizado al crear tarea. Usando localStorage.');
            }
            return data;
        } catch (e) {
            // Fallback offline
            const nueva = { ...tarea, usuario_id: this._userId(), id: this._lsNextId(), completada: 0, pomodoros_real: 0 };
            const arr = this._lsGet();
            arr.push(nueva);
            this._lsSave(arr);
            this._tareas = arr;
            return { success: true, tarea: nueva };
        }
    }

    // ── PUT: actualizar tarea ─────────────────────────────────────────────────
    async update(id, cambios) {
        if (!this._userId()) {
            const arr = this._lsGet().map(t => t.id === id ? { ...t, ...cambios } : t);
            this._lsSave(arr);
            this._tareas = arr;
            return { success: true };
        }
        try {
            const res  = await fetch(this.API_TAREAS, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id, ...cambios })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                this._tareas = this._tareas.map(t => t.id === id ? { ...t, ...cambios } : t);
                this._lsSave(this._tareas);
                return { success: true };
            }
            if (res.status === 401) {
                console.warn('No autorizado al actualizar tarea. Usando localStorage.');
            } else {
                console.warn('API no disponible al actualizar tarea. Usando localStorage.');
            }
        } catch (e) {
            console.warn('API no disponible al actualizar tarea. Usando localStorage.', e);
        }
        // Si el servidor no confirmó el cambio (error HTTP o excepción de red), aplicarlo localmente
        const arr = this._lsGet().map(t => t.id === id ? { ...t, ...cambios } : t);
        this._lsSave(arr);
        this._tareas = arr;
        return { success: true };
    }

    // ── DELETE: eliminar tarea ────────────────────────────────────────────────
    async delete(id) {
        if (!this._userId()) {
            const arr = this._lsGet().filter(t => t.id !== id);
            this._lsSave(arr);
            this._tareas = arr;
            return { success: true };
        }
        try {
            const res  = await fetch(this.API_TAREAS, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                this._tareas = this._tareas.filter(t => t.id !== id);
                this._lsSave(this._tareas);
                return { success: true };
            }
            if (res.status === 401) {
                console.warn('No autorizado al eliminar tarea. Usando localStorage.');
            } else {
                console.warn('API no disponible al eliminar tarea. Usando localStorage.');
            }
        } catch (e) {
            console.warn('API no disponible al eliminar tarea. Usando localStorage.', e);
        }
        // Si el servidor no confirmó el borrado (error HTTP o excepción de red), aplicarlo localmente
        const arr = this._lsGet().filter(t => t.id !== id);
        this._lsSave(arr);
        this._tareas = arr;
        return { success: true };
    }

    // ── Toggle completada ─────────────────────────────────────────────────────
    async toggleCompleta(id) {
        const tarea = this._tareas.find(t => t.id === id);
        if (!tarea) return { success: false };
        return this.update(id, { completada: tarea.completada ? 0 : 1 });
    }

    // ── Utilidades ────────────────────────────────────────────────────────────
    calcularUrgencia(fechaLimite) {
        const ahora    = new Date();
        const limite   = new Date(fechaLimite);
        const creacion = new Date(limite.getTime() - 7 * 24 * 60 * 60 * 1000);
        const total    = limite - creacion;
        const trans    = ahora - creacion;
        return Math.min(100, Math.max(0, Math.round((trans / total) * 100)));
    }

    etiquetaFecha(fechaLimite) {
        const ahora  = new Date();
        const limite = new Date(fechaLimite);
        const diff   = limite - ahora;
        const horas  = Math.floor(diff / 3_600_000);
        const dias   = Math.floor(diff / 86_400_000);
        if (diff < 0)   return { texto: 'Vencida',      clase: 'vence--hoy' };
        if (horas < 24) return { texto: `${horas}h`,    clase: 'vence--hoy' };
        if (dias  < 3)  return { texto: `${dias} días`, clase: 'vence--pronto' };
        return { texto: limite.toLocaleDateString('es-EC', { day:'2-digit', month:'short' }), clase: 'vence--normal' };
    }

    agruparPorDia(tareas) {
        const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const hoy  = new Date().getDay();
        const res  = dias.map((d, i) => ({ dia: d, tareas: [], esHoy: i === hoy }));
        tareas.forEach(t => {
            if (!t.fecha_limite) return;
            const d = new Date(t.fecha_limite).getDay();
            res[d].tareas.push(t);
        });
        return res;
    }

    getCached() { return [...this._tareas]; }
}

const taskModel = new TaskModel();
