import { createContext, useContext } from 'react'

export const SidebarContext = createContext(false)
export const useSidebarHover = () => useContext(SidebarContext)
