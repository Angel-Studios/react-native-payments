import React, { useState } from 'react'
import { Modal, Image, View, TouchableOpacity, StyleSheet, Text } from 'react-native'
import { LocalizedText } from '../../components/Localization'
import tstripe from 'tipsi-stripe'

import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import icoMoonConfig from '../../../assets/fonts/selection.json'
import { createIconSetFromIcoMoon } from 'react-native-vector-icons'
const Vicon = createIconSetFromIcoMoon(icoMoonConfig)

export default function NpChoose(props) {
  const { amount = false, isVisible = false, optionSetup = false, optionNative = true, optionWeb = false } = props
  const { onProgress = () => {}, payNative = () => {}, payWeb = () => {}, onClose = () => {} } = props
  const nativePayName = (Platform.OS === 'ios') ? 'Apple' : 'Google'
  const nativePayMark =
    Platform.OS === 'ios'
      ? require('../../assets/applePayMark.png')
      : require('../../assets/googlePayMark.png')

  return (
    <View style={styles.modal}>
      <TouchableOpacity
        style={{
          right: 5,
          top: 5,
          position: 'absolute',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onPress={onClose}
      >
        <Icon name='window-close' size={25} color='#7e7e7e' style={{}} />
      </TouchableOpacity>
      {amount &&
        <LocalizedText options={{ amount: amount }} style={styles.payModalTitle}>{`Confirm $${amount} payment with`}</LocalizedText>}
      {!amount &&
        <LocalizedText style={styles.payModalTitle}>{`Confirm payment with`}</LocalizedText>}
      {optionNative &&
        <TouchableOpacity
          style={{ width: '100%' }}
          onPress={() => {
            onProgress({ event: 'np_choice', meta: { choice: 'native' } })
            onClose()
            payNative()
          }}
        >
          <View style={styles.payButton}>
            <View style={styles.nativePayWrapper}>
              <Image source={nativePayMark} style={styles.nativePayMark} />
              <LocalizedText style={styles.nativePayText}>{nativePayName} Pay</LocalizedText>
            </View>
            <Vicon name='chevron-right' size={20} color='#707070' />
          </View>
        </TouchableOpacity>}
      {optionSetup &&
        <TouchableOpacity
          style={{ width: '100%' }}
          onPress={() => {
            onProgress({ event: 'np_choice', meta: { choice: 'setup' } })
            tstripe.openNativePaySetup()
          }}
        >
          <View style={styles.payButton}>
            <View style={styles.nativePayWrapper}>
              <Image source={nativePayMark} style={styles.nativePayMark} />
              <LocalizedText style={styles.nativePayText}>Setup {nativePayName} Pay</LocalizedText>
            </View>
            <Vicon name='chevron-right' size={20} color='#707070' />
          </View>
        </TouchableOpacity>}
      {optionWeb &&
        <TouchableOpacity
          style={{ width: '100%' }}
          onPress={() => {
            onProgress({ event: 'np_choice', meta: { choice: 'web' } })
            onClose()
            payWeb()
          }}
        >
          <View style={styles.payButton}>
            <View style={styles.nativePayWrapper}>
              <Image source={stripePayMark} style={styles.nativePayMark} />
              <LocalizedText style={styles.nativePayText}>Credit Card</LocalizedText>
            </View>
            <Vicon name='chevron-right' size={20} color='#707070' />
          </View>
        </TouchableOpacity>}
    </View>
  )
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: 'white',
    padding: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderColor: 'rgba(0, 0, 0, 0.1)'
  },
  payModalTitle: {
    paddingBottom: 10,
    fontSize: 18
  },
  payButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 0,
    margin: 5,
    marginTop: 10
  },
  nativePayWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  },
  nativePayMark: {
    margin: 10
  },
  nativePayText: {
    // fontFamily: 'AzoSans-Regular',
    fontSize: 20
  }
})