'use client'

import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

interface ToastState {
  toasts: Toast[]
}

const initialState: ToastState = {
  toasts: []
}

let toastState = initialState
let listeners: Array<(state: ToastState) => void> = []

function dispatch(action: { type: string; payload?: any }) {
  switch (action.type) {
    case 'ADD_TOAST':
      toastState = {
        ...toastState,
        toasts: [...toastState.toasts, action.payload]
      }
      break
    case 'REMOVE_TOAST':
      toastState = {
        ...toastState,
        toasts: toastState.toasts.filter(toast => toast.id !== action.payload)
      }
      break
    case 'CLEAR_TOASTS':
      toastState = initialState
      break
  }
  
  listeners.forEach(listener => listener(toastState))
}

export function useToast() {
  const [state, setState] = useState(toastState)

  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  }, [])

  const toast = useCallback(({ title, description, variant = 'default', duration = 5000 }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = { id, title, description, variant, duration }
    
    dispatch({ type: 'ADD_TOAST', payload: newToast })
    
    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', payload: id })
      }, duration)
    }
    
    return id
  }, [])

  const dismiss = useCallback((toastId: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: toastId })
  }, [])

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' })
  }, [])

  // Subscribe to state changes
  useState(() => {
    const unsubscribe = subscribe(setState)
    return unsubscribe
  })

  return {
    toasts: state.toasts,
    toast,
    dismiss,
    clear
  }
}